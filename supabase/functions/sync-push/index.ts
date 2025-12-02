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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // 服务端仅用 Service Role；不要在前端暴露
    const supabase = createClient(supabaseUrl, serviceKey);

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const uid = userData.user.id;

    const body = await req.json();
    const changes = Array.isArray(body?.changes) ? body.changes : [];
    if (changes.length === 0) return new Response(JSON.stringify({ applied: [], conflicts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (changes.length > 50) return new Response(JSON.stringify({ error: 'BATCH_TOO_LARGE' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // 改为 RPC：由数据库函数在单事务内处理并返回 { applied, conflicts }
    const { data: result, error: rpcError } = await supabase.rpc('apply_client_changes', { p_user_id: uid, p_changes: changes });
    if (rpcError) return new Response(JSON.stringify({ error: 'RPC_FAILED', message: rpcError.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify(result || { applied: [], conflicts: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
