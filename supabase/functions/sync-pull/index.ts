// 中文注释：/sync/pull Edge Function 模板
// 作用：返回自指定时间戳（since）之后的资源变更（示例按 updated_at 提供增量）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 中文注释：CORS 处理，允许 GET 方式的跨域调用（修复不同浏览器预检与方法不匹配问题）
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    const urlObj = new URL(req.url);
    const since = urlObj.searchParams.get('since');
    const sinceTs = since ? new Date(since).toISOString() : null;

    // 多资源聚合：links(原websites)/subscriptions/digests/generation_logs
    const wq = sinceTs ? supabase.from('links').select('*').eq('user_id', uid).gte('updated_at', sinceTs) : supabase.from('links').select('*').eq('user_id', uid);
    const sq = sinceTs ? supabase.from('subscriptions').select('*').eq('user_id', uid).gte('updated_at', sinceTs) : supabase.from('subscriptions').select('*').eq('user_id', uid);
    const dq = sinceTs ? supabase.from('digests').select('*').eq('user_id', uid).gte('updated_at', sinceTs) : supabase.from('digests').select('*').eq('user_id', uid);
    const gq = sinceTs ? supabase.from('generation_logs').select('*').eq('user_id', uid).gte('created_at', sinceTs) : supabase.from('generation_logs').select('*').eq('user_id', uid);

    const [wres, sres, dres, gres] = await Promise.all([wq, sq, dq, gq]);
    if (wres.error) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'links', message: wres.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (sres.error) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'subscriptions', message: sres.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (dres.error) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'digests', message: dres.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (gres.error) return new Response(JSON.stringify({ error: 'QUERY_FAILED', table: 'generation_logs', message: gres.error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const payload = {
      websites: wres.data || [],
      subscriptions: sres.data || [],
      digests: dres.data || [],
      generation_logs: gres.data || []
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
