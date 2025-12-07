// 中文注释：/oauth-link-callback Edge Function
// 职责：处理 OAuth 回调中的“绑定（link）”与“登录映射（login）”逻辑
// 安全：
// - 必须携带用户 JWT（Authorization: Bearer <JWT>）
// - 验证邮箱已确认（email_confirmed_at）
// - link 模式下验证 state（HMAC 签名、5 分钟有效、nonce 一次性、user_id 与 JWT 一致）
// - 所有数据库写入使用 Service Role Key；RLS 仅允许 service_role 插入

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

// 中文注释：常量时间比较，避免时序攻击（此处用于 HMAC 签名对比）
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacVerify(secret: string, payload: string, sigHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const calc = toHex(sig);
  return timingSafeEqual(calc, sigHex);
}

serve(async (req) => {
  const headers = corsHeaders();
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'METHOD_NOT_ALLOWED' } }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  try {
    // 中文注释：初始化服务端 Supabase 客户端（Service Role Key）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stateSecret = Deno.env.get('OAUTH_STATE_SECRET')!;
    const frontendBase = Deno.env.get('FRONTEND_BASE_URL') || '';
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
    const caller_uid = userData.user.id;

    // 中文注释：解析请求体
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim() || 'login';
    const provider_name = String(body?.provider_name || '').trim();
    const provider_user_id = String(body?.provider_user_id || '').trim();
    const provider_email = String(body?.provider_email || '').trim();
    const stateRaw = String(body?.state || '').trim();

    if (!provider_name || !provider_user_id) {
      return new Response(JSON.stringify({ error: { message: 'INVALID_PROVIDER' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：记录审计（先写入调用意图）
    await sb.from('auth_provider_audits').insert({
      caller_user_id: caller_uid,
      target_user_id: null,
      provider_name,
      provider_user_id,
      provider_email,
      action,
      state: stateRaw ? { raw: stateRaw } : null,
    });

    // 中文注释：link 模式下严格验证 state
    if (action === 'link') {
      if (!stateRaw) {
        return new Response(JSON.stringify({ error: { message: 'STATE_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const parts = stateRaw.split('.');
      if (parts.length !== 2) {
        return new Response(JSON.stringify({ error: { message: 'STATE_FORMAT_INVALID' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const [b64, sig] = parts;
      let payloadStr = '';
      try { payloadStr = decodeURIComponent(escape(atob(b64))); } catch {
        try { payloadStr = atob(b64); } catch { payloadStr = ''; }
      }
      if (!payloadStr) {
        return new Response(JSON.stringify({ error: { message: 'STATE_DECODE_FAILED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const ok = await hmacVerify(stateSecret, payloadStr, sig);
      if (!ok) {
        return new Response(JSON.stringify({ error: { message: 'STATE_SIGNATURE_INVALID' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      let payloadObj: any = null;
      try { payloadObj = JSON.parse(payloadStr); } catch { payloadObj = null; }
      if (!payloadObj || payloadObj.action !== 'link') {
        return new Response(JSON.stringify({ error: { message: 'STATE_ACTION_INVALID' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const now = Date.now();
      const maxAgeMs = 5 * 60 * 1000;
      if (typeof payloadObj.ts !== 'number' || now - payloadObj.ts > maxAgeMs) {
        return new Response(JSON.stringify({ error: { message: 'STATE_EXPIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      if (!payloadObj.user_id || payloadObj.user_id !== caller_uid) {
        return new Response(JSON.stringify({ error: { message: 'STATE_USER_MISMATCH' } }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const nonce = String(payloadObj.nonce || '');
      if (!nonce) {
        return new Response(JSON.stringify({ error: { message: 'STATE_NONCE_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      // 中文注释：检查 nonce 未使用，然后标记为已使用
      const { data: rec, error: getNonceErr } = await sb.from('oauth_state_nonces').select('*').eq('nonce', nonce).single();
      if (getNonceErr || !rec) {
        return new Response(JSON.stringify({ error: { message: 'STATE_NONCE_NOT_FOUND' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      if (rec.used) {
        return new Response(JSON.stringify({ error: { message: 'STATE_REPLAY' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      const { error: updErr } = await sb.from('oauth_state_nonces').update({ used: true, used_at: new Date().toISOString() }).eq('nonce', nonce);
      if (updErr) {
        return new Response(JSON.stringify({ error: { message: 'NONCE_MARK_FAILED' } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      // 中文注释：执行绑定逻辑
      // 若该 provider_user_id 已绑定到其他用户，则拒绝；若已绑定到当前用户则幂等返回成功；否则插入新绑定
      const { data: existing } = await sb
        .from('auth_providers')
        .select('id,user_id')
        .eq('provider_name', provider_name)
        .eq('provider_user_id', provider_user_id)
        .maybeSingle();

      if (existing && existing.user_id && existing.user_id !== caller_uid) {
        return new Response(JSON.stringify({ error: { message: 'ALREADY_BOUND_TO_OTHER' } }), { status: 409, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      if (!existing) {
        const { error: insErr } = await sb.from('auth_providers').insert({
          user_id: caller_uid,
          provider_name,
          provider_user_id,
          provider_email: provider_email || null,
        });
        if (insErr) {
          return new Response(JSON.stringify({ error: { message: 'INSERT_FAILED', details: insErr.message } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
      }

      await sb.from('auth_provider_audits').insert({
        caller_user_id: caller_uid,
        target_user_id: caller_uid,
        provider_name,
        provider_user_id,
        provider_email,
        action: 'link',
        state: { verified: true },
      });

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 中文注释：login 映射逻辑（根据 auth_providers 将 OAuth 会话切换到绑定的主账号）
    if (action === 'login') {
      // 查找绑定关系（provider_name + provider_user_id → user_id）
      const { data: bound, error: qErr } = await sb
        .from('auth_providers')
        .select('user_id')
        .eq('provider_name', provider_name)
        .eq('provider_user_id', provider_user_id)
        .single();
      if (qErr) {
        return new Response(JSON.stringify({ error: { message: 'QUERY_FAILED', details: qErr.message } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      if (bound?.user_id) {
        // 中文注释：为目标主账号生成一次性登录链接（magiclink），前端重定向即可完成切换
        const { data: targetUser, error: getUserErr } = await sb.auth.admin.getUserById(bound.user_id);
        if (getUserErr || !targetUser?.user) {
          return new Response(JSON.stringify({ error: { message: 'TARGET_USER_NOT_FOUND' } }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
        const email = targetUser.user.email || provider_email || '';
        if (!email) {
          return new Response(JSON.stringify({ error: { message: 'TARGET_EMAIL_REQUIRED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
        const opts = frontendBase ? { redirectTo: `${frontendBase}/dashboard.html` } : undefined as any;
        const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email, options: opts });
        if (linkErr || !linkData?.action_link) {
          return new Response(JSON.stringify({ error: { message: 'GENERATE_LINK_FAILED', details: linkErr?.message } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        await sb.from('auth_provider_audits').insert({
          caller_user_id: caller_uid,
          target_user_id: bound.user_id,
          provider_name,
          provider_user_id,
          provider_email,
          action: 'login',
          state: null,
        });

        return new Response(JSON.stringify({ action_link: linkData.action_link }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      // 未绑定：无切换，前端保持当前 OAuth 会话即可
      return new Response(JSON.stringify({ ok: true, bound: false }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // 其他 action 未定义
    return new Response(JSON.stringify({ error: { message: 'ACTION_NOT_SUPPORTED' } }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: String(e?.message || e) } }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
