// 中文注释：Dashboard 页面逻辑 (Phase 5 重构)
// 作用：初始化 Dashboard，包含访问控制、数据加载与 UI 绑定
// 依赖：@supabase/supabase-js, linkController

import { supabase } from './services/supabaseClient.js';
import { linkController } from './controllers/linkController.js';
import { initAuthUI } from './features/auth_ui.js';
import storageAdapter from './storage/storageAdapter.js';

// P5: 访问控制 - 页面加载时立即检查 Session
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[Dashboard] No active session, redirecting to login...');
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
    
    // 4. 加载主程序逻辑 (原 main.js 的部分逻辑移至此处或保留在 main.js)
    // 注意：如果 dashboard.html 仍引用 main.js，请确保 main.js 不会重复执行冲突逻辑
    // 这里假设 main.js 会处理具体的 UI 渲染 (Cards, Sidebar etc.)
    
  } catch (e) {
    console.error('[Dashboard] Init failed:', e);
    window.location.href = 'login.html';
  }
})();
