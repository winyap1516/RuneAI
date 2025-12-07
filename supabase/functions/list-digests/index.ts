// 中文注释：/digests 列表查询 Edge Function
// 作用：支持分页与按日期筛选，返回 Supabase-like 结构 { data, error }
// 安全：必须携带 JWT；仅返回本人数据（受 RLS 保护）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 中文注释：CORS 设置，允许 GET/OPTIONS 调用
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    const urlObj = new URL(req.url);
    const page = Number(urlObj.searchParams.get('page') ?? '1');
    const pageSize = Number(urlObj.searchParams.get('page_size') ?? '20');
    const date = urlObj.searchParams.get('date'); // 格式：YYYY-MM-DD（UTC）

    let q = supabase.from('digests').select('*').eq('user_id', uid).order('generated_at', { ascending: false });
    if (date) {
      q = q.gte('generated_at', `${date} 00:00:00+00`).lte('generated_at', `${date} 23:59:59+00`);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await q.range(from, to);

    return new Response(JSON.stringify({ data, error: error ? { message: error.message } : null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});

