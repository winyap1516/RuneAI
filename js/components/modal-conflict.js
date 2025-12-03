// 中文注释：冲突解决弹窗组件（Blueprint 规定）
// 作用：展示 Server vs Local 差异，提供 Keep Local / Use Server 选择

const TEMPLATE = `
<div id="rune-conflict-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;">
  <div style="width:780px;max-width:90vw;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.24);">
    <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
      <h3 style="font-size:18px;margin:0;">检测到冲突</h3>
      <button id="conflict-close" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div style="display:flex;gap:12px;padding:16px 20px;">
      <div style="flex:1;">
        <h4 style="margin:0 0 8px;">本地版本（Local）</h4>
        <pre id="conflict-local" style="max-height:320px;overflow:auto;background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:8px;"></pre>
      </div>
      <div style="flex:1;">
        <h4 style="margin:0 0 8px;">服务器版本（Server）</h4>
        <pre id="conflict-server" style="max-height:320px;overflow:auto;background:#f8fafc;border:1px solid #e5e7eb;padding:10px;border-radius:8px;"></pre>
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:16px 20px;border-top:1px solid #eee;justify-content:flex-end;">
      <button id="keep-local" style="background:#4A69FF;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;">Keep Local</button>
      <button id="use-server" style="background:#10B981;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;">Use Server</button>
    </div>
  </div>
</div>`;

/**
 * 展示冲突弹窗并返回用户选择
 * @param {{local:any, server:any}} data
 * @returns {Promise<'keepLocal'|'useServer'|'cancel'>}
 */
export function showConflictModal(data) {
  return new Promise((resolve) => {
    // 注入模板
    const wrapper = document.createElement('div');
    wrapper.innerHTML = TEMPLATE;
    document.body.appendChild(wrapper.firstElementChild);
    const modal = document.getElementById('rune-conflict-modal');

    // 填充内容
    const localEl = document.getElementById('conflict-local');
    const serverEl = document.getElementById('conflict-server');
    localEl.textContent = JSON.stringify(data?.local ?? {}, null, 2);
    serverEl.textContent = JSON.stringify(data?.server ?? {}, null, 2);

    // 事件绑定
    document.getElementById('keep-local').onclick = () => { modal.remove(); resolve('keepLocal'); };
    document.getElementById('use-server').onclick = () => { modal.remove(); resolve('useServer'); };
    document.getElementById('conflict-close').onclick = () => { modal.remove(); resolve('cancel'); };
  });
}

export default { showConflictModal };
