// 中文注释：Auth UI 逻辑 (Phase 5 重构)
// 作用：处理登录、注册表单的提交，以及 Auth 状态变更的监听与跳转
// 依赖：@supabase/supabase-js (via supabaseClient.js)

import { supabase, getSession, preflightAuth } from '/src/js/services/supabaseClient.js';
import { showToast, setBtnLoading } from '/src/js/utils/ui-helpers.js';
import { linkController } from '/src/js/controllers/linkController.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';
import config from '/src/js/services/config.js';

/**
 * 初始化 Auth UI 监听
 * @param {string} mode 'login' | 'register' | 'global'
 */
export async function initAuthUI(mode = 'global') {
  // 单例保护：防止重复初始化导致多次绑定 onAuthStateChange
  if (window.__AUTH_UI_INIT__) {
    console.log(`[AuthUI] init mode=${mode} (skipped: already initialized)`);
    return;
  }
  window.__AUTH_UI_INIT__ = true;
  console.log(`[Auth] Initializing UI in ${mode} mode`);

  // 中文注释：Mock 模式下跳过真实 Supabase 初始化与 onAuthStateChange 监听
  const isMock = Boolean(config?.useMock);

    // 1. 检查当前 Session（仅在登录/注册页检查，避免重复跳转）
    // 安全修正：如果 URL 包含 password 参数，说明发生了意外的表单提交，优先清理
    if (window.location.search.includes('password=')) {
      const url = new URL(window.location);
      url.searchParams.delete('password');
      url.searchParams.delete('email');
      url.searchParams.delete('remember');
      window.history.replaceState({}, '', url);
    }

    if (!isMock && (mode === 'login' || mode === 'register')) {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[Auth] Session valid, redirecting to dashboard');
          window.location.href = 'dashboard.html';
          return;
        }
      }
    }

  // 2. 监听 Auth 状态变更 (全局监听)
  if (!isMock && supabase) {
    // 移除旧监听（如果有）
    // 注意：supabase-js v2 没有 removeAuthStateListener，但我们可以通过 subscription.unsubscribe()
    // 但为了简单，我们依赖上方的 window.__AUTH_UI_INIT__ 单例保护
    
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event, session?.user?.id);
      
      // 过滤 INITIAL_SESSION 事件（页面加载时的初始状态，不需要重复欢迎）
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_IN' && session) {
        // 登录成功：保存用户状态，触发同步
        await handleLoginSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        // 退出登录：清理状态，跳转首页
        await handleLogoutSuccess();
      }
    });
  }

  // 3. 根据模式绑定表单
  if (mode === 'login') {
    bindLoginForm();
    bindGoogleLogin();
    bindForgotPassword();
    // 中文注释：绑定“重发验证邮件”交互
    bindResendVerification();
  } else if (mode === 'register') {
    bindSignupForm();
  }
  
  // 全局绑定退出按钮
  bindLogoutButton();
}

/**
 * 处理登录成功
 * @param {Object} user Supabase User Object
 */
async function handleLoginSuccess(user) {
  // 构造本地 User 对象
  const localUser = {
    id: user.id,
    email: user.email,
    nickname: user.user_metadata?.nickname || user.user_metadata?.full_name || user.email.split('@')[0],
    avatar: user.user_metadata?.avatar_url || `https://i.pravatar.cc/100?u=${user.id}`
  };

  // 保存到本地存储
  await storageAdapter.saveUser(localUser);
  
  showToast(`Welcome back, ${localUser.nickname}!`);

  // 触发数据同步 (TASK-P5-003)
  try {
    await linkController.initSyncAfterLogin();
  } catch (e) {
    console.warn('[Auth] Sync trigger failed:', e);
  }

  // 跳转到 Dashboard (如果不在 Dashboard)
  if (!window.location.pathname.includes('dashboard.html')) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * 处理退出成功
 */
async function handleLogoutSuccess() {
  localStorage.removeItem('rune_user'); // 清理本地 User
  localStorage.removeItem('runeai_jwt'); // 清理旧 JWT
  
  // 强力清理 Supabase SDK 可能残留的 Token
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      localStorage.removeItem(key);
    }
  });

  // 中文注释（P0 修复）：统一登出后跳转到登录页 login.html，保持与 Dashboard 守卫一致
  if (!window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
  }
}

/**
 * 绑定登录表单 (login.html)
 */
function bindLoginForm() {
  const form = document.getElementById('login-form');
  const loginBtn = document.getElementById('btn-login');
  
  if (!form || !loginBtn) return;

  // 核心登录逻辑
  const handleLogin = async () => {
    // 中文注释：Mock 模式下不调用 Supabase，直接写入本地用户并跳转
    const isMock = Boolean(config?.useMock);
    if (isMock) {
      try {
        const mockUser = { id: 'local-dev', email: 'dev@local', nickname: 'Developer', avatar: `https://i.pravatar.cc/100?img=12` };
        await storageAdapter.saveUser(mockUser);
        showToast('Mock mode enabled: signed in as local-dev', 'success');
        window.location.href = 'dashboard.html';
        return;
      } catch (e) {
        showToast('Mock login failed', 'error');
        return;
      }
    }
    if (!supabase) {
      showToast('Auth service not initialized, please check env or refresh', 'error');
      return;
    }
    // 安全修正：立即清理 URL 中的敏感参数（如果存在）
    if (window.location.search.includes('password=')) {
      const url = new URL(window.location);
      url.searchParams.delete('password');
      url.searchParams.delete('email');
      url.searchParams.delete('remember');
      window.history.replaceState({}, '', url);
    }

    const email = form.email?.value;
    const password = form.password?.value;
    const remember = form.remember?.checked === true;

    if (!email || !password) return showToast('Please enter email and password', 'error');

    try {
      setBtnLoading(loginBtn, true, 'Signing in...', 'Sign In');

      // 中文注释：若勾选“记住我”且已有有效会话，直接跳转到 Dashboard
      if (remember) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = 'dashboard.html';
          return;
        }
      }
      
      // 登录前进行一次连接预检，给出更明确的错误提示
      const pre = await preflightAuth();
      if (!pre.ok) {
        const msg = pre.status === -1
          ? 'Auth service unreachable: Check if Docker is running on port 65421'
          : (pre.status === 401
            ? 'Invalid API Key: Check VITE_SUPABASE_ANON_KEY in .env'
            : `Auth Error (${pre.status}): ${pre.message || 'UNKNOWN'}`);
        showToast(msg, 'error');
        setBtnLoading(loginBtn, false, '', 'Sign In');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange 会处理跳转；为稳妥起见，若 data.user 存在则立即触发后续逻辑
      if (data?.user) {
        await handleLoginSuccess(data.user);
      }
    } catch (e) {
      // 中文注释：统一中文提示映射（邮箱未验证、凭证错误、速率限制等）
      const raw = String(e?.message || '');
      let msg = raw;
      if (/Email not confirmed/i.test(raw)) {
        msg = 'Email not verified: Please click "Resend verification"';
        const resend = document.getElementById('resendVerifyLink');
        if (resend) {
          resend.classList.remove('hidden');
          resend.focus?.();
        }
      } else if (/Invalid login credentials/i.test(raw) || /invalid_credentials/i.test(raw)) {
        msg = 'Invalid email or password';
      } else if (/over_email_send_rate_limit/i.test(raw)) {
        msg = 'Too many requests: Please try again later';
      }
      showToast(msg, 'error');
      setBtnLoading(loginBtn, false, '', 'Sign In');
    }
  };

  // 1. 绑定按钮点击
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault(); // 双重保险
    handleLogin();
  });

  // 2. 绑定回车键
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 防止默认提交
      handleLogin();
    }
  });

  // 3. 兜底防止表单默认提交
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    return false;
  });
}

/**
 * 绑定“忘记密码”链接（login.html）
 * 行为：读取邮箱，调用 Supabase 的 resetPasswordForEmail，重定向到 reset-password 页面
 */
function bindForgotPassword() {
  const link = document.getElementById('forgotPwdLink');
  const emailInput = document.getElementById('loginEmail');
  if (!link) return;
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    if (Boolean(config?.useMock)) return showToast('Mock mode: password recovery is disabled', 'warning');
    if (!supabase) return showToast('Auth service not initialized', 'error');
    const email = String(emailInput?.value || '').trim();
    if (!email) return showToast('Please enter email address first', 'error');
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.frontendBaseUrl}/reset-password.html`
      });
      showToast('Reset email sent, please check your inbox', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to send reset email', 'error');
    }
  });
}

/**
 * 绑定“重发验证邮件”链接（login.html）
 * 行为：读取邮箱，调用 Supabase 的 resend 接口发送注册验证邮件
 */
function bindResendVerification() {
  const link = document.getElementById('resendVerifyLink');
  const emailInput = document.getElementById('loginEmail');
  if (!link) return;
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    if (Boolean(config?.useMock)) return showToast('Mock mode: verification email is disabled', 'warning');
    if (!supabase) return showToast('Auth service not initialized', 'error');
    const email = String(emailInput?.value || '').trim();
    if (!email) return showToast('Please enter email address first', 'error');
    try {
      // 中文注释：统一使用前端基址进行验证后回跳；去除 window.location.origin 兜底以强制配置完整域
      const { error } = await supabase.auth.resend({ type: 'signup', email, options: { redirectTo: `${config.frontendBaseUrl}/dashboard.html` } });
      if (error) throw error;
      showToast('Verification email resent, please check your inbox', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to send verification email', 'error');
    }
  });
}

/**
 * 绑定 Google 登录按钮
 */
function bindGoogleLogin() {
  const btn = document.getElementById('btn-google-login');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    try {
      if (Boolean(config?.useMock)) { showToast('Mock mode: OAuth login disabled', 'warning'); return; }
      // 中文注释：统一 OAuth 登录流程重定向到 oauth-callback 页面进行登录映射
      // 说明：登录场景使用 action=login，回调页将根据 auth_providers 映射到主账号
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${config.frontendBaseUrl}/oauth-callback.html?action=login`
        }
      });
      if (error) throw error;
    } catch (e) {
      showToast(e.message, 'error');
      // 中文注释：当社媒登录失败时，显示登录页上的 Recovery 小入口（低曝光灰字）
      const area = document.getElementById('recoveryFailArea');
      if (area) {
        area.classList.remove('hidden');
      }
    }
  });
}

/**
 * 绑定注册表单 (register.html)
 */
function bindSignupForm() {
  const form = document.getElementById('signup-form');
  const signupBtn = document.getElementById('btn-signup');
  const successDiv = document.getElementById('signup-success');

  if (!form || !signupBtn) return;

  // 核心注册逻辑
  const handleSignup = async () => {
    if (!supabase) {
      showToast('Auth service not initialized, please check env or refresh', 'error');
      return;
    }
    const email = form.email?.value;
    const password = form.password?.value;
    const confirm = form.confirm_password?.value;
    const nickname = form.nickname?.value;

    if (!email || !password || !confirm) return showToast('Please complete the form', 'error');
    if (String(password) !== String(confirm)) return showToast('Passwords do not match', 'error');

    try {
      setBtnLoading(signupBtn, true, 'Signing up...', 'Sign Up');
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname }
        }
      });
      if (error) throw error;
      
      // 注册成功提示
      if (data.user) {
        // 强制登出，避免自动登录，确保用户验证邮箱
        await supabase.auth.signOut();
        
        // UI 反馈
        form.reset();
        form.classList.add('hidden');
        if (successDiv) successDiv.classList.remove('hidden');
        showToast('Registration successful! Please check your email.', 'success');
      }
      
    } catch (e) {
      showToast(e.message, 'error');
      setBtnLoading(signupBtn, false, '', 'Sign Up');
    }
  };

  // 1. 绑定按钮点击
  signupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleSignup();
  });

  // 2. 绑定回车键
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSignup();
    }
  });

  // 3. 兜底防止表单默认提交
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    return false;
  });
}

/**
 * 绑定退出按钮 (全局)
 */
function bindLogoutButton() {
  // 使用委托，因为 Logout 按钮可能在下拉菜单中动态生成
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action="logout"]') || e.target.closest('#logoutBtn');
    if (!target) return;

    e.preventDefault();
    if (confirm('Are you sure you want to logout?')) {
      // 中文注释：Mock 模式下仅执行本地清理与跳转
      if (Boolean(config?.useMock)) {
        try { await handleLogoutSuccess(); } catch {}
        return;
      }
      // 中文注释：若当前无 Session/Token，直接本地清理，避免触发网络请求导致 ERR_ABORTED
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) {
          console.warn('[Auth] logout -> no session, doing local cleanup');
          await handleLogoutSuccess();
          return;
        }
      } catch {}
      try {
        // 尝试网络登出
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Network signOut failed, forcing local cleanup:', e);
      } finally {
        // 无论网络请求是否成功，都强制执行本地登出
        await handleLogoutSuccess();
      }
    }
  });
}
