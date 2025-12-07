// 中文注释：订阅设置面板（统一管理订阅频道、目标ID、频率与开关）
import storageAdapter from "/src/js/storage/storageAdapter.js";

export function mountSubscriptionSettings(container) {
  if (!container) return;
  const current = storageAdapter.getGlobalSubscriptionStatus();
  const settings = safeLoadSettings();
  const channel = settings.channel || current.channel || 'none';
  const targetId = settings.target_id || current.target_id || '';
  const frequency = settings.frequency || current.frequency || 'off';
  const enabled = current.enabled || frequency !== 'off';

  container.innerHTML = `
    <div class="p-4 space-y-4">
      <h3 class="text-sm font-bold">Subscription Settings</h3>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium mb-2">Channel</label>
          <select id="subChannel" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 text-xs px-3">
            <option value="none" ${channel==='none'?'selected':''}>None</option>
            <option value="telegram" ${channel==='telegram'?'selected':''}>Telegram</option>
            <option value="whatsapp" ${channel==='whatsapp'?'selected':''}>WhatsApp</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium mb-2">Target ID</label>
          <input id="subTargetId" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 text-xs px-3" placeholder="Chat ID or Phone" value="${escapeHTML(targetId)}" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium mb-2">Digest Frequency</label>
          <select id="subFrequency" class="w-full h-9 rounded-lg bg-gray-50 dark:bg白/5 border border-gray-200 text-xs px-3">
            <option value="daily" ${frequency==='daily'?'selected':''}>Daily</option>
            <option value="off" ${frequency!=='daily'?'selected':''}>Off</option>
          </select>
        </div>
        <div class="flex items-end">
          <label class="inline-flex items-center gap-2 text-xs">
            <input id="subEnabled" type="checkbox" class="form-checkbox" ${enabled?'checked':''} />
            <span>Subscription Status</span>
          </label>
        </div>
      </div>

      <div class="text-right">
        <button id="subSaveBtn" class="h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold">Save</button>
      </div>
    </div>
  `;

  const elChannel = container.querySelector('#subChannel');
  const elTarget = container.querySelector('#subTargetId');
  const elFreq = container.querySelector('#subFrequency');
  const elEnabled = container.querySelector('#subEnabled');
  const saveBtn = container.querySelector('#subSaveBtn');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const newChannel = String(elChannel.value || 'none');
      const newTarget = String(elTarget.value || '').trim();
      const newFreq = String(elFreq.value || 'off');
      const newEnabled = !!elEnabled.checked;

      setBtnLoading(saveBtn, true, 'Saving...');
      try {
        // 中文注释：先保存全局设置，随后批量更新所有订阅记录（按当前用户的所有网站）
        saveSettings({ channel: newChannel, target_id: newTarget, frequency: newFreq });
        await storageAdapter.setGlobalSubscriptionSettings({ enabled: newEnabled, frequency: newFreq, channel: newChannel, target_id: newTarget });
      } catch (err) {
        console.error('[SubscriptionSettings] save failed', err);
      } finally {
        setBtnLoading(saveBtn, false);
      }
    });
  }
}

function safeLoadSettings() {
  try { return JSON.parse(localStorage.getItem('rune_subscription_settings') || '{}'); } catch { return {}; }
}

function saveSettings(s) {
  try { localStorage.setItem('rune_subscription_settings', JSON.stringify({ ...(safeLoadSettings()||{}), ...s, updated_at: new Date().toISOString() })); } catch {}
}

function setBtnLoading(btn, active, text) {
  if (!btn) return;
  if (active) {
    btn.dataset.orig = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span> ${text||'Saving...'}`;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.orig || 'Save';
    btn.disabled = false;
  }
}

function escapeHTML(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
