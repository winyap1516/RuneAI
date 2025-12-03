// 中文注释：Auth UI 逻辑 (Phase 5 重构)
// 作用：处理登录、注册表单的提交，以及 Auth 状态变更的监听与跳转
// 依赖：@supabase/supabase-js (via supabaseClient.js)

import { supabase, getSession } from '../services/supabaseClient.js';
import { showToast } from '../utils/ui-helpers.js';
import { linkController } from '../controllers/linkController.js';
import storageAdapter from '../storage/storageAdapter.js';

/**
 * 初始化 Auth UI 监听
 * @param {string} mode 'login' | 'register' | 'global'
 */
export async function initAuthUI(mode = 'global') {
  console.log(`[Auth] Initializing UI in ${mode} mode`);

    // 1. 检查当前 Session（仅在登录/注册页检查，避免重复跳转）
    // 安全修正：如果 URL 包含 password 参数，说明发生了意外的表单提交，优先清理
    if (window.location.search.includes('password=')) {
      const url = new URL(window.location);
      url.searchParams.delete('password');
      url.searchParams.delete('email');
      url.searchParams.delete('remember');
      window.history.replaceState({}, '', url);
    }

    if (mode === 'login' || mode === 'register') {
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
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change:', event, session?.user?.id);
      
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
    nickname: user.user_metadata?.nickname || user.email.split('@')[0],
    avatar: user.user_metadata?.avatar_url || `https://i.pravatar.cc/100?u=${user.id}`
  };

  // 保存到本地存储
  await storageAdapter.saveUser(localUser);
  
  showToast(`欢迎回来, ${localUser.nickname}!`);

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
  localStorage.removeItem('runeai_jwt'); // 清理旧 JWT (SDK 也会自动清理)
  
  // 跳转到 Login
  if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
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
    if (!supabase) {
      showToast('认证服务未初始化，请检查环境变量或刷新页面', 'error');
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

    if (!email || !password) return showToast('请输入邮箱和密码', 'error');

    try {
      loginBtn.disabled = true;
      loginBtn.textContent = '登录中...';

      // 中文注释：若勾选“记住我”且已有有效会话，直接跳转到 Dashboard
      if (remember) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = 'dashboard.html';
          return;
        }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange 会处理跳转；为稳妥起见，若 data.user 存在则立即触发后续逻辑
      if (data?.user) {
        await handleLoginSuccess(data.user);
      }
    } catch (e) {
      showToast(e.message, 'error');
      loginBtn.disabled = false;
      loginBtn.textContent = '登录';
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
 * 绑定 Google 登录按钮
 */
function bindGoogleLogin() {
  const btn = document.getElementById('btn-google-login');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard.html'
        }
      });
      if (error) throw error;
    } catch (e) {
      showToast(e.message, 'error');
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
      showToast('认证服务未初始化，请检查环境变量或刷新页面', 'error');
      return;
    }
    const email = form.email?.value;
    const password = form.password?.value;
    const confirm = form.confirm_password?.value;
    const nickname = form.nickname?.value;

    if (!email || !password || !confirm) return showToast('请填写完整并确认密码', 'error');
    if (String(password) !== String(confirm)) return showToast('两次输入的密码不一致', 'error');

    try {
      signupBtn.disabled = true;
      signupBtn.textContent = '注册中...';
      
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
      }
      
    } catch (e) {
      showToast(e.message, 'error');
      signupBtn.disabled = false;
      signupBtn.textContent = '立即注册';
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
    if (confirm('确定要退出登录吗？')) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // onAuthStateChange 会处理跳转
      } catch (e) {
        showToast(e.message, 'error');
      }
    }
  });
}
