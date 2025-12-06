// 中文注释：/request-recovery Edge Function
// 作用：接受用户标识（邮箱/账号 ID），若存在且绑定了已验证的恢复邮箱，则生成一次性恢复令牌并发送验证链接
// 行为：开发环境返回 preview 链接；生产环境根据 EMAIL_PROVIDER（sendgrid/mailgun）实际发送邮件
// 安全：不要求用户登录；令牌一次性、1 小时有效；增加同 IP 15 分钟 ≥5 次限流；统一响应避免泄露邮箱是否存在

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function isDev() { return (Deno.env.get('ENV') || Deno.env.get('NODE_ENV') || '').toLowerCase() !== 'production'; }

// 中文注释：发送邮件（SendGrid 实现）
async function sendViaSendGrid(to: string, subject: string, text: string, html: string): Promise<{ ok: boolean; response?: unknown }> {
  const key = Deno.env.get('EMAIL_API_KEY') || '';
  const from = Deno.env.get('EMAIL_FROM') || '';
  const fromName = Deno.env.get('EMAIL_FROM_NAME') || 'Rune';
  if (!key || !from) return { ok: false, response: { reason: 'MISSING_CONFIG' } };
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: from, name: fromName },
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  });
  return { ok: resp.status >= 200 && resp.status < 300 };
}

// 中文注释：发送邮件（Mailgun 实现）
async function sendViaMailgun(to: string, subject: string, text: string, html: string): Promise<{ ok: boolean; response?: unknown }> {
  const key = Deno.env.get('EMAIL_API_KEY') || '';
  const domain = Deno.env.get('MAILGUN_DOMAIN') || '';
  const from = Deno.env.get('EMAIL_FROM') || '';
  if (!key || !domain || !from) return { ok: false, response: { reason: 'MISSING_CONFIG' } };
  const auth = 'Basic ' + btoa('api:' + key);
  const form = new URLSearchParams();
  form.set('from', from);
  form.set('to', to);
  form.set('subject', subject);
  form.set('text', text);
  form.set('html', html);
  const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString()
  });
  return { ok: resp.status >= 200 && resp.status < 300 };
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: { message: 'METHOD_NOT_ALLOWED' } }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });

  try {
    // 中文注释：初始化服务端 Supabase 客户端（Service Role）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const frontendBase = Deno.env.get('FRONTEND_BASE_URL') || '';
    const sb = createClient(supabaseUrl, serviceKey);

    // 中文注释：解析请求体与来源 IP（用于审计与限速）
    const body = await req.json().catch(() => ({}));
    const identifier = String(body?.identifier || '').trim();
    const client_req_id = String(body?.client_req_id || crypto.randomUUID());
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    if (!identifier) return new Response(JSON.stringify({ error: { message: 'IDENTIFIER_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });

    // 中文注释：限流（同 IP 在 15 分钟内 ≥5 次）
    {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recent, error: rateErr } = await sb
        .from('account_recovery_audits')
        .select('id')
        .eq('action', 'request')
        .eq('ip', ip)
        .gte('created_at', since);
      if (!rateErr && Array.isArray(recent) && recent.length >= 5) {
        return new Response(JSON.stringify({ error: { message: 'RATE_LIMITED' } }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }

    // 中文注释：基础限流实现已在上方完成，此处不重复执行

    // 中文注释：查找用户与已验证恢复邮箱（优先使用 recovery_emails；否则回退到主邮箱匹配）
    let userId: string | null = null;
    let sendToEmail: string | null = null;
    {
      const { data: recs, error: recErr } = await sb.from('recovery_emails').select('*').eq('email', identifier).eq('verified', true).limit(1);
      if (!recErr && Array.isArray(recs) && recs.length > 0) {
        userId = recs[0].user_id;
        sendToEmail = recs[0].email;
      }
    }
    if (!userId) {
      const { data: users, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw listErr;
      const match = (users.users || []).find(u => String(u.email || '').toLowerCase() === identifier.toLowerCase());
      if (match) { userId = match.id; sendToEmail = match.email || null; }
    }

    if (!userId || !sendToEmail) {
      // 中文注释：统一响应以避免泄露账号是否存在；仍写入审计记录以便运营分析
      await sb.from('account_recovery_audits').insert({ user_id: null, email: null, action: 'request', client_req_id, ip, details: { identifier, note: 'no_match' } });
      const payload = isDev() ? { sent: true, preview_link: '' } : { sent: true };
      return new Response(JSON.stringify({ data: payload }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：生成一次性恢复令牌（1 小时有效）
    const rnd = crypto.getRandomValues(new Uint8Array(32));
    const token = toHex(rnd.buffer);
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const nonce = crypto.randomUUID();
    const { error: tokErr } = await sb.from('account_recovery_tokens').insert({ user_id: userId, token, context: 'recovery', nonce, expires_at: expires, requested_ip: ip });
    if (tokErr) throw tokErr;

    // 中文注释：构造确认链接（通过 Edge Function GET /confirm-recovery 重定向到创建密码页面）
    const confirmUrl = `${supabaseUrl}/functions/v1/confirm-recovery?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(frontendBase ? `${frontendBase}/set-password.html` : '')}`;

    // 中文注释：开发环境返回预览链接；生产环境按配置发送邮件
    if (isDev()) {
      const payload = { sent: true, preview_link: confirmUrl };
      return new Response(JSON.stringify({ data: payload }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    } else {
      const provider = (Deno.env.get('EMAIL_PROVIDER') || '').toLowerCase();
      const subject = '账户恢复验证（1 小时内有效）';
      const text = `点击以下链接以恢复你的账号：\n${confirmUrl}\n\n该链接 1 小时内有效。如果不是你本人操作，请忽略。`;
      const html = `<p>点击以下链接以恢复你的账号（<strong>1 小时内有效</strong>）：</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>如果不是你本人操作，请忽略。</p>`;
      let ok = false;
      try {
        if (provider === 'sendgrid') {
          const res = await sendViaSendGrid(sendToEmail!, subject, text, html);
          ok = res.ok;
        } else if (provider === 'mailgun') {
          const res = await sendViaMailgun(sendToEmail!, subject, text, html);
          ok = res.ok;
        } else {
          // 未配置受支持的提供商：标记为未发送但返回统一响应
          ok = false;
        }
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        // 中文注释：发送失败写审计并返回统一响应（不泄露细节）
        await sb.from('account_recovery_audits').insert({ user_id: userId, email: sendToEmail, action: 'send_email_failed', client_req_id, ip, details: { provider } });
      }
      const payload = { sent: true };
      return new Response(JSON.stringify({ data: payload }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
});
