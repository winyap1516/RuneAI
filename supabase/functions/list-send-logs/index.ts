// 中文注释：/list-send-logs Edge Function
// 作用：按用户身份返回发送日志（支持 channel/status/date 筛选，默认最近 100 条）
// 安全：必须携带 JWT；服务端使用 Service Role，但强制按用户过滤（不依赖 RLS）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: { message: 'METHOD_NOT_ALLOWED' } }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: { message: 'UNAUTHORIZED' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    // 中文注释：解析筛选参数（channel/status/date）
    const u = new URL(req.url);
    const channel = u.searchParams.get('channel') || '';
    const status = u.searchParams.get('status') || '';
    const date = u.searchParams.get('date') || '';
    const limit = Number(u.searchParams.get('limit') || '100');

    // 中文注释：查出该用户的 digest_id 列表（强制按用户过滤）
    const { data: digests, error: dErr } = await supabase
      .from('digests')
      .select('id')
      .eq('user_id', uid);
    if (dErr) return new Response(JSON.stringify({ error: { message: dErr.message } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const digestIds = (digests || []).map(d => d.id);
    if (!digestIds.length) return new Response(JSON.stringify({ data: [], error: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 中文注释：按条件查询 send_logs（按 created_at 倒序，默认最多 100 条）
    let q = supabase.from('send_logs').select('*').in('digest_id', digestIds).order('created_at', { ascending: false });
    if (channel) q = q.eq('channel', channel);
    if (status) q = q.eq('status', status);
    if (date) q = q.gte('created_at', `${date} 00:00:00+00`).lte('created_at', `${date} 23:59:59+00`);
    const { data, error } = await q.limit(limit);

    return new Response(JSON.stringify({ data, error: error ? { message: error.message } : null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});

