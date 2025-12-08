// 中文注释：配置模块（project_rules.md 指定）
// 作用：集中管理环境变量与运行时校验，fail-fast 提示缺失配置

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (window?.ENV || {});

export const config = {
  supabaseUrl: String(env?.VITE_SUPABASE_URL || '').trim(),
  supabaseAnonKey: String(env?.VITE_SUPABASE_ANON_KEY || '').trim(),
  stripePublicKey: String(env?.VITE_STRIPE_PUBLIC_KEY || '').trim(),
  frontendBaseUrl: String(env?.VITE_FRONTEND_BASE_URL || '').trim(),
  // 中文注释：Mock 模式开关（前端专用，允许完全脱离后端进行 UI 开发与测试）
  useMock: String(env?.VITE_USE_MOCK || '').trim() === 'true' || (typeof window !== 'undefined' && window.__FORCE_MOCK__ === true),
  // 中文注释：外部 Mock API Base（例如 http://localhost:4000），设置后前端可切换到 HTTP Mock
  mockApiBase: String(env?.VITE_MOCK_API_BASE || '').trim(),
  uiConflictEnabled: true, // 默认启用冲突 UI（与 blueprint 对齐）
  validate() {
    // 中文注释：若启用 Mock 模式，直接跳过 Supabase 环境变量校验（前端将脱离后端运行）
    if (this.useMock) {
      try { console.warn('[Config] Mock 模式启用，跳过 Supabase 环境校验'); } catch {}
      return;
    }
    const missing = [];
    if (!this.supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!this.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    // 中文注释：Base URL 条件校验策略
    // 说明：仅当使用邮箱回跳 / OAuth 跳转时必须设置；否则给出警告但不阻断启动
    if (!this.frontendBaseUrl) {
      try { console.warn('[Config] 未设置 VITE_FRONTEND_BASE_URL，邮箱回跳 / OAuth 将不可用'); } catch {}
    }
    // 中文注释：外部 Mock API 不参与强校验，若设置则打印提示
    if (this.mockApiBase) {
      try { console.warn('[Config] 前端将使用外部 Mock API：', this.mockApiBase); } catch {}
    }
    if (missing.length) {
      throw new Error(`缺少必要环境变量：${missing.join(', ')}`);
    }
  }
};

export default config;
