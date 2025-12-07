// 中文注释：Dashboard 页面逻辑 (Phase 5 重构)
// 作用：初始化 Dashboard，包含访问控制、数据加载与 UI 绑定
// 依赖：@supabase/supabase-js, linkController

import { supabase } from './services/supabaseClient.js';
import { linkController } from './controllers/linkController.js';
import { initAuthUI } from './features/auth_ui.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';
import { initDashboard } from './features/dashboard.js';

// P5: 访问控制 - 页面加载时立即检查 Session
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // 中文注释（P0 修复）：未登录状态统一跳转至 login.html（与登出行为一致）
      console.warn('[Dashboard] No active session, redirecting to login.html');
      window.location.href = 'login.html';
      return;
    }
    
    // 初始化 Dashboard
    console.log('[Dashboard] Session valid, initializing...');
    
    // 1. 初始化 Auth UI (监听登出等)
    initAuthUI('global');
    
    // 2. 恢复用户状态 (从 LocalStorage 或 Session)
    const localUser = storageAdapter.getUser();
    if (!localUser && session.user) {
      // 如果本地无用户数据但有 Session，尝试恢复
      const user = session.user;
      const restoredUser = {
        id: user.id,
        email: user.email,
        nickname: user.user_metadata?.nickname || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url || `https://i.pravatar.cc/100?u=${user.id}`
      };
      await storageAdapter.saveUser(restoredUser);
    }

    // 3. 触发同步 (确保数据是最新的)
    linkController.initSyncAfterLogin();
    
    // 4. 加载主程序逻辑 (原 main.js 的部分逻辑移至此处)
    // 确保仅在 Auth Ready 后调用一次
    initDashboard();
    
  } catch (e) {
    console.error('[Dashboard] Init failed:', e);
    window.location.href = 'index.html';
  }
})();
