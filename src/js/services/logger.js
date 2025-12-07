// 中文注释：统一日志模块（project_rules.md 要求）
// 说明：所有模块通过此入口记录日志，便于审计与调试

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS.debug;

export function setLevel(level = 'info') {
  if (LEVELS[level] !== undefined) currentLevel = LEVELS[level];
}

function log(level, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  // 统一输出到 console（后续可接入远程日志）
  // 禁止在其他模块散乱使用 console
  console[level === 'debug' ? 'log' : level](prefix, ...args);
}

export const logger = {
  debug: (...args) => log('debug', ...args),
  info: (...args) => log('info', ...args),
  warn: (...args) => log('warn', ...args),
  error: (...args) => log('error', ...args),
};

export default logger;
