// 中文注释：/sync/push Edge Function 模板
// 作用：批量接收客户端变更并应用到数据库，返回 { applied, conflicts }
// 要点：
// - 校验 JWT（Supabase 自动注入身份）
// - 限制批量大小 ≤ 50
// - 幂等：按 client_change_id 唯一去重
// - 事务：建议改为调用 Postgres RPC（存储过程）以确保原子性（此处为模板占位）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // 中文注释：CORS 处理，允许浏览器跨域调用本地 Edge Function（修复 net::ERR_ABORTED）
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // 服务端仅用 Service Role；不要在前端暴露
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    let uid = userData?.user?.id || '';

    const raw = await req.text();
    console.log('[sync-push] Raw Body:', raw);
    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch (e) {
      console.error('[sync-push] JSON parse error:', e?.message || e);
      return new Response(JSON.stringify({ error: 'INVALID_JSON_BODY' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // 中文注释：Admin Override（服务角色测试）：当 Authorization 为 Service Role 且缺少用户 JWT，允许从 body.user_id 指定目标用户
    const isServiceAuth = jwt && jwt === serviceKey;
    if ((!uid || userErr) && isServiceAuth && body?.user_id) {
      uid = String(body.user_id);
      console.log('[sync-push] Admin override user_id=', uid);
    }
    if (!uid) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    console.log('[sync-push] Changes Count:', changes.length);
    if (changes.length === 0) return new Response(JSON.stringify({ applied: [], conflicts: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (changes.length > 50) return new Response(JSON.stringify({ error: 'BATCH_TOO_LARGE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 改为 RPC：由数据库函数在单事务内处理并返回 { applied, conflicts }
    const { data: result, error: rpcError } = await supabase.rpc('apply_client_changes', { p_user_id: uid, p_changes: changes });
    if (rpcError) {
      console.error('[sync-push] RPC_FAILED:', rpcError?.message || rpcError);
      return new Response(JSON.stringify({ error: 'RPC_FAILED', message: rpcError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    console.log('[sync-push] Applied Count:', Array.isArray(result?.applied) ? result.applied.length : 0, 'Conflicts Count:', Array.isArray(result?.conflicts) ? result.conflicts.length : 0);
    return new Response(JSON.stringify(result || { applied: [], conflicts: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
