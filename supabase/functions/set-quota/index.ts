// 中文注释：管理员额度设置 Edge Function（/set-quota）
// 作用：仅管理员可通过受控接口设置指定用户的每日限额与一次性额外额度
// 安全：校验 JWT，要求用户具有 admin 角色（user.app_metadata.role 或 user.user_metadata.role）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function isAdmin(user: any): boolean {
  // 中文注释：在 Supabase 中可利用 app_metadata 或 user_metadata 存储角色
  const appRole = user?.app_metadata?.role;
  const userRole = user?.user_metadata?.role;
  return appRole === 'admin' || userRole === 'admin';
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  try {
    // 中文注释：初始化服务端 Supabase 客户端（Service Role Key）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 中文注释：校验来访用户（必须携带用户 JWT）
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    if (!isAdmin(userData.user)) {
      console.warn('[SetQuota] forbidden: non-admin user attempted to set quota');
      return new Response(JSON.stringify({ error: 'FORBIDDEN', message: 'admin only' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：解析请求体（目标用户与额度参数）
    const { user_id, daily_limit, extra_credits = 0 } = await req.json();
    if (!user_id || typeof daily_limit !== 'number' || daily_limit < 0) {
      return new Response(JSON.stringify({ error: 'INVALID_PAYLOAD' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：写入或更新 user_quotas（幂等 upsert）
    const { error: upErr } = await sb
      .from('user_quotas')
      .upsert({ user_id, daily_limit, extra_credits, updated_at: new Date().toISOString() });
    if (upErr) {
      console.error('[SetQuota] upsert failed:', upErr.message);
      return new Response(JSON.stringify({ error: 'UPSERT_FAILED', message: upErr.message }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：审计日志记录（admin → target 用户额度变更）
    await sb.from('admin_audit_logs').insert({
      admin_user_id: userData.user.id,
      target_user_id: user_id,
      action: 'set_quota',
      payload: { daily_limit, extra_credits }
    });

    console.info('[SetQuota] quota updated for user', user_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[SetQuota] internal error:', e);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
});
