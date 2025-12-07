// 中文注释：前端入口聚合（位于 public/ 根下，确保经过 Vite 处理并注入 import.meta.env）
// 职责：统一入口，按页面按需加载 src/ 下模块；避免在 HTML 中直接使用 "../src/..." 造成 /@fs 加载与环境变量未注入问题。

// 中文注释：始终加载通用入口（包含全局初始化与快捷工具）
import '/src/js/main.js';

// 中文注释：根据当前页面按需加载模块
const path = window.location.pathname || '';

// Dashboard 页面：初始化（欢迎卡组件由 features/dashboard.js 内部静态导入，避免重复加载导致变量重定义）
if (path.includes('dashboard.html')) {
  import('/src/js/dashboard_init.js');
}

// 登录页：加载 Auth UI 并初始化登录模式
if (path.includes('login.html')) {
  // 确保 Supabase 客户端初始化
  import('/src/js/services/supabaseClient.js');
  import('/src/js/features/auth_ui.js').then(mod => {
    try { mod.initAuthUI && mod.initAuthUI('login'); } catch {}
  });
}

// 注册页：加载 Auth UI 并初始化注册模式
if (path.includes('register.html')) {
  import('/src/js/services/supabaseClient.js');
  import('/src/js/features/auth_ui.js').then(mod => {
    try { mod.initAuthUI && mod.initAuthUI('register'); } catch {}
  });
}

// OAuth 回调页：加载视图脚本（自执行）
if (path.includes('oauth-callback.html')) {
  import('/src/js/views/oauth_callback.js');
}

// 其它页面：默认仅加载 main.js（如 index.html / signup.html / recovery / reset 等）
