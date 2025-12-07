// 中文注释：Welcome Card 组件（Dashboard 顶部欢迎卡片，简化版）
// 职责：渲染用户欢迎信息与快捷入口；提供最小 API 以兼容现有调用。

/**
 * 渲染欢迎卡片
 * @param {HTMLElement} container 容器元素
 * @param {{ status?: string, nickname?: string, stats?: object, onClickStat?: Function, onReadMoreDigest?: Function, onRetryFetch?: Function }} props 属性
 */
export function renderWelcomeCard(container, props = {}) {
  if (!container) return;
  const status = String(props.status || 'ready');
  const nickname = String(props.nickname || 'User');

  if (status === 'loading') {
    container.innerHTML = `
      <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-white/5">
        <div class="animate-pulse h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="mt-3 animate-pulse h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-white/5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold">欢迎回来，${nickname}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">这里是你的知识概览与快捷入口。</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="welcomeReadMore" class="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold">查看摘要</button>
          <button id="welcomeRetry" class="h-9 px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-sm">刷新</button>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-3">
        <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-500">Links</div>
          <div class="text-xl font-bold">${props.stats?.links ?? '-'}</div>
        </div>
        <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-500">Subscriptions</div>
          <div class="text-xl font-bold">${props.stats?.subs ?? '-'}</div>
        </div>
        <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div class="text-xs text-gray-500">Digests</div>
          <div class="text-xl font-bold">${props.stats?.digests ?? '-'}</div>
        </div>
      </div>
    </div>
  `;

  const readBtn = container.querySelector('#welcomeReadMore');
  const retryBtn = container.querySelector('#welcomeRetry');
  readBtn?.addEventListener('click', () => {
    try { props.onReadMoreDigest?.(); } catch {}
  });
  retryBtn?.addEventListener('click', () => {
    try { props.onRetryFetch?.(); } catch {}
  });
}

/**
 * 导航到欢迎视图（占位实现）
 */
export function navigateToWelcome() {
  // 中文注释：当前导航由 Dashboard 控制，此处保留占位以兼容旧代码
  return true;
}

export default { renderWelcomeCard, navigateToWelcome };
