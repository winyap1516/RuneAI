// 中文注释：Dashboard 页面逻辑 (Phase 5 重构)
// 作用：初始化 Dashboard，包含访问控制、数据加载与 UI 绑定
// 依赖：@supabase/supabase-js, linkController

import { supabase } from './services/supabaseClient.js';
import { linkController } from './controllers/linkController.js';
import { initAuthUI } from './features/auth_ui.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';
import { initDashboard } from './features/dashboard.js';
import logger from './services/logger.js';
import { runSyncDiagnostics } from './diagnostic_sync.js'; // Import diagnostic tool
import config from './services/config.js'; // Ensure config is imported

// P5: 访问控制 - 页面加载时立即检查 Session
(async () => {
  try {
    // 中文注释：统一使用 Supabase，会话有效性作为访问控制依据
    const isDev = import.meta.env.DEV;
    // 如果启用本地模式，跳过 Supabase Session 检查
    let session = null;
    if (!config.useLocalDev) {
        const ss = await (supabase?.auth?.getSession?.());
        session = ss?.data?.session || null;
    }
    
    // 中文注释：移除本地 mock 用户注入逻辑，改为统一的登录校验

    const localUser = storageAdapter.getUser();
    if (!session && !localUser) {
      // 中文注释：开发者绕过登录（本地联调）
      // 支持 config.useLocalDev 自动注入
      if ((import.meta.env.DEV && (await import('./services/config.js')).config.devAllowDashboard) || config.useLocalDev) {
        logger.warn('[Dashboard] Dev bypass enabled: injecting local user');
        await storageAdapter.saveUser({
          id: 'dev-local-id',
          email: 'dev@test.com',
          nickname: 'Local Developer',
          avatar: 'https://i.pravatar.cc/100?u=dev'
        });
      } else {
        // 中文注释：未登录状态统一跳转至 login.html（与登出行为一致）
        logger.warn('[Dashboard] No active session, redirecting to login.html');
        window.location.href = 'login.html';
        return;
      }
    }
    
    // 初始化 Dashboard
    logger.info('[Dashboard] 初始化应用…');
    
    // 1. 初始化 Auth UI (监听登出等)
    initAuthUI('global');
    
    // 2. 恢复用户状态 (从 LocalStorage 或 Session)
    if (!localUser && session?.user) {
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
    // Python 后端适配：恢复 syncLoop，它现在会指向 Python API
    linkController.initSyncAfterLogin();
    
    // 4. 加载主程序逻辑 (原 main.js 的部分逻辑移至此处)
    // 确保仅在 Auth Ready 后调用一次
    initDashboard();
    
  } catch (e) {
    logger.error('[Dashboard] Init failed:', e);
    window.location.href = 'index.html';
  }
})();
