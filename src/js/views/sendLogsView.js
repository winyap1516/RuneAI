// 中文注释：发送日志视图（开发/调试用）
// 职责：渲染最近的发送队列与日志（send_queue / send_logs）的简化视图；
//      在无后端可用时显示占位提示，避免 Dashboard 导航到该视图时报错。

let _containerEl = null;
let _utils = null;
let _supabaseClient = null;

/**
 * 初始化发送日志视图
 * @param {{ containerEl: HTMLElement, utils: any, supabaseClient: any }} opts
 */
export function initSendLogsView(opts = {}) {
  // 中文注释：保存上下文引用（容器、工具、客户端）
  _containerEl = opts.containerEl || null;
  _utils = opts.utils || null;
  _supabaseClient = opts.supabaseClient || null;

  // 中文注释：首次渲染占位内容（避免空白）
  renderSendLogs();
}

/**
 * 渲染发送日志列表（简化版）
 * - 若后端不可用：显示占位文案与开发提示
 * - 若后端可用：尝试调用 Edge Function 获取最近日志
 */
export async function renderSendLogs() {
  if (!_containerEl) return;
  const { dom, config } = _utils || {};
  const mountHTML = dom?.mountHTML;
  const show = dom?.show;

  // 中文注释：挂载基本布局（标题 + 列表容器）
  const html = `
    <div class="mb-4">
      <h1 class="text-2xl font-bold">Send Logs</h1>
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">最近的发送队列与日志（开发占位视图）。</p>
    </div>
    <div id="sendLogsList" class="flex flex-col gap-2"></div>
  `;
  if (typeof mountHTML === 'function') {
    mountHTML(_containerEl, html);
  } else {
    _containerEl.innerHTML = html;
  }
  if (typeof show === 'function') show(_containerEl);

  const listEl = _containerEl.querySelector('#sendLogsList');

  // 中文注释：若未配置后端地址，则显示占位提示
  const supabaseUrl = String(config?.supabaseUrl || '').trim();
  if (!supabaseUrl) {
    listEl.innerHTML = `<div class="text-sm text-gray-600 dark:text-gray-400">未配置 Supabase URL（VITE_SUPABASE_URL）。此视图仅在开发中占位，不会发起请求。</div>`;
    return;
  }

  // 中文注释：尝试从 Edge Function 读取最近 20 条发送日志（若已实现）
  try {
    const headers = typeof _supabaseClient?.getAuthHeaders === 'function'
      ? await _supabaseClient.getAuthHeaders()
      : { 'Content-Type': 'application/json' };
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-logs`, { headers });
    const payload = await resp.json().catch(() => ({}));
    const logs = Array.isArray(payload?.data) ? payload.data : [];
    if (!logs.length) {
      listEl.innerHTML = `<div class="text-sm text-gray-600 dark:text-gray-400">暂无日志或接口未实现。</div>`;
      return;
    }
    listEl.innerHTML = logs.map(l => {
      const status = String(l.status || 'unknown');
      const ts = l.ts || l.created_at || '';
      const digestId = l.digest_id || '';
      return `<div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
        <div class="flex items-center justify-between">
          <span class="font-semibold">${status.toUpperCase()}</span>
          <span class="text-xs text-gray-500">${ts}</span>
        </div>
        <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">digest_id: ${digestId}</div>
      </div>`;
    }).join('');
  } catch (e) {
    // 中文注释：接口不可用或报错时显示占位提示
    listEl.innerHTML = `<div class="text-sm text-red-600">读取失败：${String(e?.message || e || 'UNKNOWN')}</div>`;
  }
}

export default { initSendLogsView, renderSendLogs };
