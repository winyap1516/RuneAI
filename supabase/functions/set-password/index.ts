// 中文注释：/set-password Edge Function
// 作用：在验证通过的恢复会话下为既有用户设置密码，开启 email+password 登录能力
// 安全：要求有效的 set_password 令牌；强密码校验；写审计；禁止创建新用户

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: { message: 'METHOD_NOT_ALLOWED' } }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '').trim();
    const newPwd = String(body?.new_password || '').trim();
    const client_req_id = String(body?.client_req_id || crypto.randomUUID());
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    if (!token) return new Response(JSON.stringify({ error: { message: 'TOKEN_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (!newPwd) return new Response(JSON.stringify({ error: { message: 'PASSWORD_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 中文注释：强密码校验（至少 8 位，包含字母与数字；可根据策略增强）
    const strong = newPwd.length >= 8 && /[A-Za-z]/.test(newPwd) && /\d/.test(newPwd);
    if (!strong) return new Response(JSON.stringify({ error: { message: 'PASSWORD_WEAK' } }), { status: 422, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 中文注释：验证 set_password 令牌
    const { data: rows, error: qErr } = await sb.from('account_recovery_tokens').select('*').eq('token', token).eq('context', 'set_password').limit(1);
    if (qErr) throw qErr;
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return new Response(JSON.stringify({ error: { message: 'TOKEN_NOT_FOUND' } }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (row.used) return new Response(JSON.stringify({ error: { message: 'TOKEN_ALREADY_USED' } }), { status: 409, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (Date.now() > new Date(row.expires_at).getTime()) return new Response(JSON.stringify({ error: { message: 'TOKEN_EXPIRED' } }), { status: 410, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 中文注释：更新既有用户的密码（禁止创建新用户）
    const { error: updUserErr } = await sb.auth.admin.updateUserById(row.user_id, { password: newPwd });
    if (updUserErr) return new Response(JSON.stringify({ error: { message: updUserErr.message || 'UPDATE_FAILED' } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 标记令牌已使用
    const { error: markErr } = await sb.from('account_recovery_tokens').update({ used: true, used_at: new Date().toISOString() }).eq('id', row.id);
    if (markErr) throw markErr;

    // 审计（创建密码）
    await sb.from('account_recovery_audits').insert({ user_id: row.user_id, action: 'create_password', client_req_id, ip, details: { token_preview: String(token).slice(0, 8) + '…' } });

    return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
});

