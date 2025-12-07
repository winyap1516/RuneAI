// 中文注释：/enqueue-send Edge Function
// 作用：将指定 digest 写入发送队列（send_queue），仅允许本人操作
// 安全：必须携带 JWT；受 RLS 与业务校验双重保护

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    const { digest_id } = await req.json();
    if (!digest_id) return new Response(JSON.stringify({ error: 'BAD_REQUEST', message: 'digest_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 中文注释：校验 digest 属于当前用户
    const { data: digest, error: dErr } = await supabase.from('digests').select('id,user_id').eq('id', digest_id).single();
    if (dErr || !digest) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (digest.user_id !== uid) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 中文注释：写入队列
    const { error: qErr } = await supabase.from('send_queue').insert({ digest_id });
    if (qErr) return new Response(JSON.stringify({ error: 'INSERT_FAILED', message: qErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});

