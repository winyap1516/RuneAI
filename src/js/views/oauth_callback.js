// 中文注释：OAuth 回调页脚本
// 职责：解析 action/state，读取当前 Supabase 会话用户身份，调用 Edge Function 完成链接或登录映射
// 重定向策略：统一使用 config.frontendBaseUrl 作为前端基址；缺失时回退 window.location.origin，确保本地与生产一致

import { supabase } from '/src/js/services/supabaseClient.js';
import { invokeJSON } from '/src/js/services/api.js';
import config from '/src/js/services/config.js';

function setMsg(t) {
  const el = document.getElementById('msg');
  if (el) el.textContent = t;
}

// 中文注释：state 已采用“payloadBase64.HMAC”结构，由后端生成与验证；前端不解析，原样传回
function getRawState(str) {
  return String(str || '');
}

(async function main() {
  // 1) 解析查询参数
  const url = new URL(window.location.href);
  const action = url.searchParams.get('action') || 'login';
  const stateStr = url.searchParams.get('state') || '';
  const state = getRawState(stateStr);

  // 2) 读取当前 OAuth 会话用户
  setMsg('读取会话…');
  // 中文注释：使用 Supabase SDK 读取当前登录用户；OAuth 回跳成功后应已存在有效 session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    setMsg('未获取到用户信息，请返回登录页重试');
    // 中文注释：统一跳转到登录页（优先使用前端基址）
    const base = config.frontendBaseUrl || window.location.origin;
    setTimeout(() => { window.location.href = `${base}/login.html`; }, 1600);
    return;
  }

  // 3) 提取 Provider 身份信息（identity_id / provider / email）
  // Supabase v2: user.identities 数组包含 provider 身份
  const idents = Array.isArray(user.identities) ? user.identities : [];
  const primary = idents[0] || null; // 登录回调场景通常只有一个最近的身份
  const provider_name = primary?.provider || 'google';
  const provider_user_id = primary?.identity_id || '';
  const provider_email = primary?.email || user.email || '';

  // 4) 调用 Edge Function 完成链接或登录映射
  setMsg(action === 'link' ? '正在绑定提供商到当前账号…' : '正在检查登录映射…');
  const payload = {
    action,
    provider_name,
    provider_user_id,
    provider_email,
    state,
  };

  const { data, error, status } = await invokeJSON('oauth-link-callback', { method: 'POST', body: payload });
  if (error) {
    setMsg(`处理失败（${status}）：${error.message || 'UNKNOWN_ERROR'}`);
    return;
  }

  // 5) 根据返回值跳转或提示
  if (action === 'link') {
    setMsg('绑定成功，正在返回仪表盘…');
    const base = config.frontendBaseUrl || window.location.origin;
    setTimeout(() => { window.location.href = `${base}/dashboard.html`; }, 800);
  } else {
    // 登录映射：若返回 magic action_link，则跳转该链接以登录到主账号
    if (data && data.action_link) {
      setMsg('检测到绑定映射，正在切换到主账号…');
      window.location.href = data.action_link;
    } else {
      setMsg('未检测到绑定映射，保持当前登录状态');
      const base = config.frontendBaseUrl || window.location.origin;
      setTimeout(() => { window.location.href = `${base}/dashboard.html`; }, 800);
    }
  }
})();

