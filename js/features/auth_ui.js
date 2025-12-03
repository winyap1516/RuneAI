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
  if (mode === 'login' || mode === 'register') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('[Auth] Session valid, redirecting to dashboard');
      window.location.href = 'dashboard.html';
      return;
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
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email?.value;
    const password = form.password?.value;
    const btn = form.querySelector('button[type="submit"]');

    if (!email || !password) return showToast('请输入邮箱和密码', 'error');

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '登录中...';
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange 会处理跳转
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '登录';
      }
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
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email?.value;
    const password = form.password?.value;
    const nickname = form.nickname?.value;
    const btn = form.querySelector('button[type="submit"]');
    const successDiv = document.getElementById('signup-success');

    if (!email || !password) return showToast('请输入邮箱和密码', 'error');

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '注册中...';
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname }
        }
      });
      if (error) throw error;
      
      // 注册成功提示
      if (data.user && !data.session) {
        // 需要验证邮箱
        form.reset();
        form.classList.add('hidden');
        if (successDiv) successDiv.classList.remove('hidden');
      } else if (data.session) {
        // 自动登录成功 (某些配置下)
        showToast('注册成功！即将跳转...');
      }
      
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '立即注册';
      }
    }
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
