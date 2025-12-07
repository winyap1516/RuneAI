// 中文注释：/generate-digest Edge Function
// 作用：为指定用户生成 Digest（手动 manual 或定时 scheduled），写入 digests，并在满足条件时写入 send_queue
// 安全：必须携带 JWT（Authorization: Bearer <JWT>），服务端使用 SERVICE_ROLE_KEY，前端仅使用 anon key

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 中文注释：CORS 设置，允许 POST/OPTIONS 调用
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 中文注释：初始化 Supabase（服务端 Service Role Key）并校验用户身份
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // 中文注释：强制邮箱验证校验（未验证邮箱禁止生成/购买等敏感操作）
    if (!userData.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'EMAIL_NOT_CONFIRMED' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    // 中文注释：解析请求参数 { user_id, mode: 'manual'|'scheduled' }
    const { user_id, mode = 'manual' } = await req.json();
    if (!user_id || user_id !== uid) {
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 中文注释：读取该用户的 links（或 websites，根据现有表）
    const { data: links, error: linksErr } = await supabase.from('links').select('*').eq('user_id', uid);
    if (linksErr) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'links', message: linksErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 中文注释：并发安全生成摘要（事务函数）
    const title = `日报 ${new Date().toLocaleDateString()}`;
    const summary = `Mock 日报：您共有 ${links?.length ?? 0} 条收藏，示例摘要...`;
    const { data: txRes, error: txErr } = await supabase.rpc('generate_digest_with_quota', {
      p_user_id: uid,
      p_mode: mode,
      p_title: title,
      p_summary: summary
    });
    if (txErr) {
      if (String(txErr.message || '').includes('DAILY_LIMIT_REACHED')) {
        return new Response(JSON.stringify({ error: 'DAILY_LIMIT_REACHED' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'INSERT_FAILED', message: txErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const digestId = txRes?.id;
    const { data: inserted, error: getErr } = await supabase.from('digests').select('*').eq('id', digestId).single();
    if (getErr) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'digests', message: getErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 中文注释：仅当为 scheduled 且存在启用且频率不为 off 的订阅时入队
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id,enabled,frequency')
      .eq('user_id', uid)
      .eq('enabled', true);
    const hasActive = (subs ?? []).some(s => (s.frequency ?? 'daily') !== 'off');
    if (mode === 'scheduled' && hasActive) {
      await supabase.from('send_queue').insert({ digest_id: inserted.id });
      // 更新订阅最近生成时间戳（便于后续频率判断）
      await supabase.from('subscriptions').update({ last_generated_at: new Date().toISOString() }).eq('user_id', uid).eq('enabled', true);
    }

    // 中文注释：额度扣减已在事务函数中处理，此处无需重复扣减

    // 中文注释：返回 digest 预览（summary + title + links 数量）
    const preview = { title: inserted.title, summary: inserted.summary, link_count: links?.length ?? 0 };
    return new Response(JSON.stringify({ ok: true, digest: inserted, preview }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
