// 中文注释：配置模块（project_rules.md 指定）
// 作用：集中管理环境变量与运行时校验，fail-fast 提示缺失配置

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (window?.ENV || {});

export const config = {
  supabaseUrl: String(env?.VITE_SUPABASE_URL || '').trim(),
  supabaseAnonKey: String(env?.VITE_SUPABASE_ANON_KEY || '').trim(),
  uiConflictEnabled: true, // 默认启用冲突 UI（与 blueprint 对齐）
  validate() {
    const missing = [];
    if (!this.supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!this.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
    if (missing.length) {
      throw new Error(`缺少必要环境变量：${missing.join(', ')}`);
    }
  }
};

export default config;
