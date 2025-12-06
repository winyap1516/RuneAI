// 中文注释：/confirm-recovery Edge Function
// 作用：验证一次性恢复令牌（token），通过后颁发短期“设置密码令牌”并重定向到 /set-password.html
// 安全：令牌一次性；过期拒绝；写审计；避免信息泄露（统一提示）

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: { message: 'METHOD_NOT_ALLOWED' } }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const u = new URL(req.url);
    const token = String(u.searchParams.get('token') || '').trim();
    const redirectBase = u.searchParams.get('redirect') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    if (!token) return new Response(JSON.stringify({ error: { message: 'TOKEN_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 中文注释：查找并验证恢复令牌
    const { data: rows, error: qErr } = await sb.from('account_recovery_tokens').select('*').eq('token', token).eq('context', 'recovery').limit(1);
    if (qErr) throw qErr;
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return new Response(JSON.stringify({ error: { message: 'TOKEN_NOT_FOUND' } }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (row.used) return new Response(JSON.stringify({ error: { message: 'TOKEN_ALREADY_USED' } }), { status: 409, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (Date.now() > new Date(row.expires_at).getTime()) return new Response(JSON.stringify({ error: { message: 'TOKEN_EXPIRED' } }), { status: 410, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 标记 recovery 令牌为已使用
    const { error: updErr } = await sb.from('account_recovery_tokens').update({ used: true, used_at: new Date().toISOString() }).eq('id', row.id);
    if (updErr) throw updErr;

    // 审计（确认恢复）
    await sb.from('account_recovery_audits').insert({ user_id: row.user_id, action: 'confirm', ip, details: { token_preview: String(token).slice(0, 8) + '…' } });

    // 颁发短期“设置密码令牌”（15 分钟有效）
    const rnd = crypto.getRandomValues(new Uint8Array(32));
    const setPwdToken = toHex(rnd.buffer);
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: insErr } = await sb.from('account_recovery_tokens').insert({ user_id: row.user_id, token: setPwdToken, context: 'set_password', expires_at: expires });
    if (insErr) throw insErr;

    // 如果提供了 redirect 基址，则 302 重定向到 /set-password.html?token=...
    if (redirectBase) {
      const location = `${redirectBase}?token=${encodeURIComponent(setPwdToken)}`;
      return new Response('', { status: 302, headers: { ...headers, Location: location } });
    }

    // 否则返回 JSON（用于开发/测试）
    return new Response(JSON.stringify({ data: { token: setPwdToken, expires_at: expires } }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
});

