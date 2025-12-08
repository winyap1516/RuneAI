// 中文注释：Dashboard 页面逻辑 (Phase 5 重构)
// 作用：初始化 Dashboard，包含访问控制、数据加载与 UI 绑定
// 依赖：@supabase/supabase-js, linkController

import { supabase } from './services/supabaseClient.js';
import { linkController } from './controllers/linkController.js';
import { initAuthUI } from './features/auth_ui.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';
import { initDashboard } from './features/dashboard.js';
import logger from './services/logger.js';
import { api as mockApi, useMock } from './services/apiRouter.js';

// P5: 访问控制 - 页面加载时立即检查 Session
(async () => {
  try {
    // 中文注释：Mock 模式检测（优先级高于 Supabase 会话检查）
    const isDev = import.meta.env.DEV;
    const enabledMock = useMock;
    let session = null;
    if (!enabledMock) {
      const ss = await (supabase?.auth?.getSession?.());
      session = ss?.data?.session || null;
    } else {
      logger.info('[Dashboard] Mock mode enabled');
      logger.info('[Dashboard] Supabase initialization skipped');
    }
    
    // 补救措施：如果 Dev 模式下没有 Session 且没有本地用户，主动注入 local-dev 账号
    // 避免因 main.js 执行顺序导致被误判为未登录
    if ((enabledMock || isDev) && !session && !storageAdapter.getUser()) {
      logger.info('[Dashboard] 注入本地开发用户 (mock/local-dev)…');
      await storageAdapter.saveUser({
        id: 'local-dev',
        nickname: 'Developer',
        email: 'dev@local',
        avatar: 'https://i.pravatar.cc/100?img=12'
      });
    }

    const localUser = storageAdapter.getUser();
    const isLocalDev = (enabledMock || isDev) && localUser?.id === 'local-dev';

    if (!enabledMock && !session && !isLocalDev) {
      // 中文注释（P0 修复）：未登录状态统一跳转至 login.html（与登出行为一致）
      logger.warn('[Dashboard] No active session, redirecting to login.html');
      window.location.href = 'login.html';
      return;
    }
    
    // 初始化 Dashboard
    logger.info('[Dashboard] 初始化应用…');
    
    // 1. 初始化 Auth UI (监听登出等)
    initAuthUI(enabledMock ? 'mock' : 'global');
    
    // 2. 恢复用户状态 (从 LocalStorage 或 Session)
    if (!enabledMock && !localUser && session?.user) {
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
    if (!enabledMock) {
      linkController.initSyncAfterLogin();
    } else {
      try { await mockApi.loadBundle(); } catch (e) { logger.warn('[Dashboard] 加载 Mock Bundle 失败：', e?.message || e); }
    }
    
    // 4. 加载主程序逻辑 (原 main.js 的部分逻辑移至此处)
    // 确保仅在 Auth Ready 后调用一次
    initDashboard();
    
  } catch (e) {
    logger.error('[Dashboard] Init failed:', e);
    window.location.href = 'index.html';
  }
})();
