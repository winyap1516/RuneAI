

export const DIGEST_TYPE = {
  MANUAL: 'manual',
  DAILY: 'daily'
};

// 中文注释：统一用户标识常量（供前端在未登录或本地开发时使用）
// DEFAULT：本地开发与离线模式的默认用户 ID（与 IndexedDB 默认值一致）
// GUEST：未登录状态下的兜底用户标识（用于仅需 UID 占位的场景）
export const USER_ID = {
  DEFAULT: 'local-dev',
  GUEST: 'guest'
};

export const LIMITS = {
  DAILY_GENERATE: 0, // 设置为0用于测试配额限制
  SINGLE_GENERATE: 5,
  DEV_LIMIT: 999
};

export const COOLDOWN = {
  DURATION_MS: 60000
};

export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: 'sidebarCollapsed'
};
