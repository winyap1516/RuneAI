// utils/dom.js
// =============================
// 🧩 RuneAI DOM Helper Library
// =============================

// 简化选择器
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

// 创建元素
export function createEl(tag, options = {}) {
  const el = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "html") el.innerHTML = value;
    else el.setAttribute(key, value);
  });
  return el;
}

// 清空元素内容
export function clearEl(el) {
  if (el) el.innerHTML = "";
}

// 渐显动画
export function fadeIn(el, duration = 300) {
  el.style.opacity = 0;
  el.style.display = "block";
  let last = +new Date();
  const tick = function() {
    el.style.opacity = +el.style.opacity + (new Date() - last) / duration;
    last = +new Date();
    if (+el.style.opacity < 1) {
      requestAnimationFrame(tick);
    }
  };
  tick();
}

// 折叠展开动画（侧边栏可用）
export function slideToggle(el, duration = 200) {
  if (!el) return;
  if (el.style.maxHeight) {
    el.style.transition = `max-height ${duration}ms ease-in-out`;
    el.style.maxHeight = null;
  } else {
    el.style.transition = `max-height ${duration}ms ease-in-out`;
    el.style.maxHeight = el.scrollHeight + "px";
  }
}

/**
 * 中文注释：清空容器并插入新的 HTML 片段
 * 目的：用于在 <main> 或任意容器中动态渲染模块内容
 * 参数：
 * - container: 目标容器 HTMLElement
 * - html: 待插入的 HTML 字符串
 * 行为：先调用 clearEl(container) 清空，再使用 insertAdjacentHTML 追加到末尾
 */
export function mountHTML(container, html) {
  if (!container) return;
  clearEl(container);
  container.insertAdjacentHTML('beforeend', html);
}

// =============================
// 事件与显示工具（新增）
// =============================

/**
 * 中文注释：为指定元素绑定事件
 * @param {Element|Window|Document} el 目标元素
 * @param {string} type 事件类型，如 'click'
 * @param {Function} handler 事件处理函数
 */
export function on(el, type, handler) {
  if (!el) return;
  el.addEventListener(type, handler);
}

/**
 * 中文注释：事件委托，在容器上监听并匹配子选择器
 * @param {Element} container 容器元素
 * @param {string} selector 匹配的子元素选择器
 * @param {string} type 事件类型
 * @param {Function} handler 处理函数，传入匹配到的目标元素
 */
export function delegate(container, selector, type, handler) {
  if (!container) return;
  container.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) {
      handler(e, target);
    }
  });
}

/**
 * 中文注释：显示元素（移除 hidden 类并设置 display）
 */
export function show(el) {
  if (!el) return;
  el.classList.remove('hidden');
  el.style.display = '';
}

/**
 * 中文注释：隐藏元素（添加 hidden 类）
 */
export function hide(el) {
  if (!el) return;
  el.classList.add('hidden');
}

/**
 * 中文注释：切换显示隐藏
 */
export function toggle(el) {
  if (!el) return;
  if (el.classList.contains('hidden')) show(el);
  else hide(el);
}

/**
 * 中文注释：打开模态框
 * 约定：模态元素默认包含 `hidden` 类，Backdrop 可选，id 形如 `#xxxBackdrop`
 */
export function openModal(modalEl) {
  if (!modalEl) return;
  show(modalEl);
  // 中文注释：设置全局模态开启标记，阻止头像等全局点击交互在模态期间触发
  try { document.body.dataset.modalOpen = '1'; } catch {}
  const backdrop = modalEl.querySelector('[id$="Backdrop"]') || modalEl.querySelector('.modal-backdrop');
  if (backdrop) {
    on(backdrop, 'click', () => closeModal(modalEl));
  }
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') closeModal(modalEl);
  });
}

/**
 * 中文注释：关闭模态框
 */
export function closeModal(modalEl) {
  if (!modalEl) return;
  hide(modalEl);
  // 中文注释：清除全局模态开启标记，恢复头像等交互
  try { delete document.body.dataset.modalOpen; } catch {}
}

/**
 * 中文注释：通用确认模态封装
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {Function} options.onOk
 * @param {boolean} options.okDanger
 * @param {string} options.okText
 */
export function openConfirm({ title = 'Confirm action?', message = 'This action cannot be undone.', onOk = () => {}, okDanger = false, okText = 'Confirm' } = {}) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const btnCancel = document.getElementById('confirmCancel');
  const btnOk = document.getElementById('confirmOk');
  if (!modal || !titleEl || !msgEl || !btnCancel || !btnOk) return;
  
  titleEl.textContent = title;
  msgEl.textContent = message;
  btnOk.textContent = okText;
  
  // 确保 Confirm Modal 拥有最高的 z-index，显示在 Settings 遮罩层之上
  modal.style.zIndex = "99999"; 
  show(modal);
  document.body.dataset.modalOpen = '1';
  
  if (okDanger) { 
    btnOk.classList.add('bg-red-600','text-white'); 
  } else { 
    btnOk.classList.remove('bg-red-600','text-white'); 
  }
  
  const cleanup = () => {
    hide(modal);
    // 注意：如果还有其他 modal 打开（如 settings），不要删除 modalOpen 标记
    // 简单判断：如果 Settings Panel 也是打开的，就不删
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel || settingsPanel.classList.contains('hidden')) {
      delete document.body.dataset.modalOpen;
    }
    modal.style.zIndex = ""; // 还原 z-index
    btnCancel.removeEventListener('click', onCancel);
    btnOk.removeEventListener('click', onConfirm);
  };
  
  const onCancel = () => cleanup();
  const onConfirm = () => { try { onOk(); } finally { cleanup(); } };
  
  btnCancel.addEventListener('click', onCancel);
  btnOk.addEventListener('click', onConfirm);
}

/**
 * 中文注释：通用信息提示模态（替代 alert，只包含 OK 按钮）
 */
export function openInfoModal({ title = 'Notice', message = '', onOk = () => {} } = {}) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const btnCancel = document.getElementById('confirmCancel');
  const btnOk = document.getElementById('confirmOk');
  if (!modal || !titleEl || !msgEl || !btnCancel || !btnOk) return;
  
  titleEl.textContent = title;
  msgEl.textContent = message;
  btnOk.textContent = 'OK';
  btnCancel.style.display = 'none'; // Hide cancel button
  
  modal.style.zIndex = "99999";
  show(modal);
  document.body.dataset.modalOpen = '1';
  
  const cleanup = () => {
    hide(modal);
    btnCancel.style.display = ''; // Restore cancel button
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsPanel || settingsPanel.classList.contains('hidden')) {
      delete document.body.dataset.modalOpen;
    }
    modal.style.zIndex = "";
    btnOk.removeEventListener('click', onConfirm);
  };
  
  const onConfirm = () => { try { onOk(); } finally { cleanup(); } };
  btnOk.addEventListener('click', onConfirm);
}

/**
 * 中文注释：通用文本输入模态（替代 prompt）
 */
export async function openTextPrompt({ title='Input', placeholder='' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('textPromptModal');
    const input = document.getElementById('textPromptInput');
    const ttl = document.getElementById('textPromptTitle');
    const btnOk = document.getElementById('textPromptOk');
    const btnCancel = document.getElementById('textPromptCancel');
    if (!modal || !input || !ttl || !btnOk || !btnCancel) return resolve(null);
    ttl.textContent = title;
    input.value = '';
    input.placeholder = placeholder;
    modal.style.display = 'flex';
    function cleanup() {
      modal.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
    }
    function onOk() { cleanup(); resolve(input.value); }
    function onCancel() { cleanup(); resolve(null); }
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    setTimeout(() => input.focus(), 0);
  });
}
