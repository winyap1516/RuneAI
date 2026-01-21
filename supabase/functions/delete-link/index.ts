import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 中文注释：删除链接函数
// 功能：删除当前登录用户的 links 记录（按 user_id + url 定位）
// 安全：必须携带 Authorization: Bearer <JWT>
// CORS：允许 authorization, apikey, content-type 头；支持 OPTIONS 预检
serve(async (req) => {
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
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    // 兼容：如果前端只传了 url，尝试回退到 url 删除（但不推荐）
    const url = String(body?.url || '').trim();

    if (!id && !url) {
      return new Response(JSON.stringify({ error: 'Missing ID or URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const RUNTIME_KEY = SERVICE_KEY || ANON_KEY;
    if (!SUPABASE_URL || !RUNTIME_KEY) {
      return new Response(JSON.stringify({ error: 'SERVER_NOT_CONFIGURED' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(SUPABASE_URL, RUNTIME_KEY);

    // 中文注释：鉴权（从 Authorization 获取 JWT 并解析 user）
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    // 优先按 ID 删除，确保精确匹配
    let query = supabase.from('links').delete().eq('user_id', uid);
    if (id) {
        query = query.eq('id', id);
    } else {
        query = query.eq('url', url);
    }
    
    const { error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
