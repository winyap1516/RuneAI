// 中文注释：/generate-oauth-state Edge Function
// 作用：为 OAuth Linking 生成安全的 state（HMAC 签名 + 一次性 nonce + 5 分钟时效）
// 安全：仅接受已登录且邮箱已验证的用户请求；服务端使用 SERVICE_ROLE_KEY；secret 存于 Edge 环境变量 OAUTH_STATE_SECRET

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
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(sig);
}

// 中文注释：简单速率限制（内存桶）：每用户每 60 秒最多签发 10 次 state
// 说明：Edge Function 进程内持久于存活周期内，适合作为轻量防滥用；生产可扩展为 Redis/DB 级限流
const RATE_BUCKETS: Map<string, { windowStart: number; count: number }> = new Map();
const WINDOW_MS = 60_000; // 60 秒窗口
const LIMIT_PER_WINDOW = 10; // 每窗口最多 10 次

function checkRateLimit(uid: string) {
  const now = Date.now();
  const b = RATE_BUCKETS.get(uid);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    RATE_BUCKETS.set(uid, { windowStart: now, count: 1 });
    return { allowed: true };
  }
  if (b.count >= LIMIT_PER_WINDOW) {
    return { allowed: false, retryAfter: Math.ceil((b.windowStart + WINDOW_MS - now) / 1000) };
  }
  b.count += 1;
  RATE_BUCKETS.set(uid, b);
  return { allowed: true };
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
    const stateSecret = Deno.env.get('OAUTH_STATE_SECRET')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 中文注释：校验来访用户（必须已登录且邮箱已验证）
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: { message: 'UNAUTHORIZED' } }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    if (!userData.user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: { message: 'EMAIL_NOT_CONFIRMED' } }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    // 中文注释：速率限制检查（超出返回 429，并记录告警日志）
    const rl = checkRateLimit(uid);
    if (!rl.allowed) {
      console.warn('[GenerateOAuthState] rate-limit exceeded', { uid, retryAfter: rl.retryAfter });
      return new Response(JSON.stringify({ error: { message: 'RATE_LIMIT_EXCEEDED', retry_after: rl.retryAfter } }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：解析请求体（仅允许 action='link' 且 user_id 必须与 JWT 一致）
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim() || 'link';
    const user_id = String(body?.user_id || '').trim();
    if (action !== 'link') {
      return new Response(JSON.stringify({ error: { message: 'INVALID_ACTION' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
    if (!user_id || user_id !== uid) {
      return new Response(JSON.stringify({ error: { message: 'FORBIDDEN' } }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：生成一次性 nonce 并写入数据库（用于防重放）
    const nonce = crypto.randomUUID();
    const { error: nonceErr } = await sb.from('oauth_state_nonces').insert({ nonce, used: false });
    if (nonceErr) {
      return new Response(JSON.stringify({ error: { message: 'NONCE_INSERT_FAILED', details: nonceErr.message } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：构造 payload 并进行 HMAC-SHA256 签名
    const ts = Date.now();
    const payloadObj = { action, user_id, nonce, ts };
    const payloadStr = JSON.stringify(payloadObj);
    const payloadB64 = btoa(unescape(encodeURIComponent(payloadStr)));
    const sigHex = await hmacSign(stateSecret, payloadStr);
    const state = `${payloadB64}.${sigHex}`;

    // 中文注释：签发事件日志（可扩展为插入审计表）
    console.info('[GenerateOAuthState] issued', { uid, nonce, ts });
    return new Response(JSON.stringify({ state }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
