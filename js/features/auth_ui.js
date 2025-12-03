// 中文注释：Auth UI 逻辑
// 作用：处理登录、注册表单的提交，以及 Auth 状态变更的监听与跳转
// 依赖：@supabase/supabase-js (via supabaseClient.js)

import { supabase, getSession, getUser } from '../services/supabaseClient.js';
import { showToast } from '../utils/ui-helpers.js';
import { initSyncAfterLogin } from '../controllers/linkController.js';
import storageAdapter from '../storage/storageAdapter.js';

/**
 * 初始化 Auth UI 监听
 * 在 main.js 中调用
 */
export function initAuthUI() {
  // 1. 监听 Auth 状态变更
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

  // 2. 绑定表单事件 (如果存在)
  bindLoginForm();
  bindSignupForm();
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
    await initSyncAfterLogin();
  } catch (e) {
    console.warn('[Auth] Sync trigger failed:', e);
  }

  // 如果当前在登录页/注册页，跳转到 Dashboard
  const path = window.location.pathname;
  if (path.includes('index.html') || path.includes('signup.html') || path === '/') {
    window.location.href = 'dashboard.html';
  }
}

/**
 * 处理退出成功
 */
async function handleLogoutSuccess() {
  localStorage.removeItem('rune_user'); // 清理本地 User
  localStorage.removeItem('runeai_jwt'); // 清理旧 JWT (SDK 也会自动清理)
  
  // 跳转到 Landing
  if (!window.location.pathname.includes('index.html')) {
    window.location.href = 'index.html';
  }
}

/**
 * 绑定登录表单 (modal_login.html / index.html)
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
      if (btn) btn.disabled = true;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange 会处理跳转
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) btn.disabled = false;
    }
  });
}

/**
 * 绑定注册表单 (signup.html)
 */
function bindSignupForm() {
  const form = document.getElementById('signup-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email?.value;
    const password = form.password?.value;
    const nickname = form.nickname?.value; // 假设有昵称字段
    const btn = form.querySelector('button[type="submit"]');

    if (!email || !password) return showToast('请输入邮箱和密码', 'error');

    try {
      if (btn) btn.disabled = true;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname }
        }
      });
      if (error) throw error;
      
      showToast('注册成功！请查收确认邮件或直接登录。');
      // 注册后通常需要确认邮件，或者直接登录 (取决于 Supabase 配置)
      // 如果配置了“Enable Confirm Email”，则不会立即 SIGNED_IN
      if (data.session) {
        // 自动登录成功
      } else {
        // 需要确认邮件
        setTimeout(() => window.location.href = 'index.html', 2000);
      }
    } catch (e) {
      showToast(e.message, 'error');
      if (btn) btn.disabled = false;
    }
  });
}

/**
 * 绑定退出按钮 (全局)
 */
function bindLogoutButton() {
  // 使用委托，因为 Logout 按钮可能在下拉菜单中动态生成
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action="logout"]');
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
