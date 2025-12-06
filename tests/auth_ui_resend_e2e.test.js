/* @vitest-environment jsdom */
// 中文注释：login 页面 UI 绑定的端到端测试（jsdom）
// 覆盖：重发验证邮件 + 忘记密码链接行为

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase Client
vi.mock('../js/services/supabaseClient.js', () => {
  const auth = {
    resend: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: { ok: true }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
    getSession: vi.fn(async () => ({ data: { session: null } })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
  };
  return { supabase: { auth } };
});

// Mock config
vi.mock('../js/services/config.js', () => ({ default: { frontendBaseUrl: 'http://localhost:5173' } }));

import { initAuthUI } from '../js/features/auth_ui.js';

function setupLoginDOM() {
  document.body.innerHTML = `
    <form id="login-form">
      <input id="loginEmail" />
      <button id="btn-login" type="button">登录</button>
    </form>
    <a id="resendVerifyLink" href="#">重发验证邮件</a>
    <a id="forgotPwdLink" href="#">忘记密码</a>
    <button id="btn-google-login" type="button">Google</button>
  `;
}

describe('Auth UI bindings on login page', () => {
  beforeEach(() => { vi.clearAllMocks(); setupLoginDOM(); delete window.__AUTH_UI_INIT__; });

  it('clicking resendVerifyLink should call supabase.auth.resend', async () => {
    await initAuthUI('login');
    const emailInput = document.getElementById('loginEmail');
    emailInput.value = 'a@b.com';
    const link = document.getElementById('resendVerifyLink');
    link.click();
    // 微小延迟等待事件处理
    await new Promise(r => setTimeout(r, 0));
    const mod = await import('../js/services/supabaseClient.js');
    expect(mod.supabase.auth.resend).toHaveBeenCalledTimes(1);
  });

  it('clicking forgotPwdLink should call supabase.auth.resetPasswordForEmail', async () => {
    await initAuthUI('login');
    const emailInput = document.getElementById('loginEmail');
    emailInput.value = 'b@c.com';
    const link = document.getElementById('forgotPwdLink');
    link.click();
    await new Promise(r => setTimeout(r, 0));
    const mod = await import('../js/services/supabaseClient.js');
    expect(mod.supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
});
