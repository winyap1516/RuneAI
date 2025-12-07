// 中文注释：用户欢迎卡组件（恢复旧版设计）
// 职责：加载并挂载 `public/components/card_userinfo.html` 模板，填充用户数据与提示
// 说明：仅操作 DOM，不包含业务拉取；数据来源于 storageAdapter 与本地设置。

import storageAdapter from '../storage/storageAdapter.js';

/**
 * 中文注释：格式化时间为“YYYY-MM-DD HH:mm”
 */
function formatTime(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch { return ''; }
}

/**
 * 中文注释：根据时间段生成问候语（早安/午安/晚安）
 */
function greet(name = '朋友') {
  const h = new Date().getHours();
  if (h < 12) return `早安，${name} 🌅`;
  if (h < 18) return `午安，${name} 🌞`;
  return `晚安，${name} 🌙`;
}

/**
 * 中文注释：读取 AI 风格（本地设置），默认 creative
 */
function getAiStyle() {
  try {
    const raw = localStorage.getItem('rune_ai_style');
    const val = String(raw || 'creative');
    const map = { professional: '正式模式', casual: '轻松模式', creative: '创意模式' };
    return map[val] || '创意模式';
  } catch { return '创意模式'; }
}

/**
 * 中文注释：挂载欢迎卡模板并填充数据
 * @param {HTMLElement} container `#userWelcomeCard` 容器
 */
export async function mountUserWelcomeCard(container) {
  const target = container || document.getElementById('userWelcomeCard');
  if (!target) return;

  // 加载模板（相对页面路径，public 作为 root）
  const resp = await fetch('./components/card_userinfo.html').catch(() => null);
  const html = await (resp?.text?.() || Promise.resolve(''));
  if (!html) return;
  target.innerHTML = html;

  // 读取用户与统计
  const user = storageAdapter.getUser() || { nickname: 'Developer', avatar: 'https://i.pravatar.cc/100?img=12', id: 'local-dev' };
  let linksCount = 0, subsCount = 0, digestsCount = 0;
  try {
    const links = await storageAdapter.getLinks();
    const subs = await storageAdapter.getSubscriptions();
    const digests = await storageAdapter.getDigests();
    linksCount = Array.isArray(links) ? links.length : 0;
    subsCount = Array.isArray(subs) ? subs.length : 0;
    digestsCount = Array.isArray(digests) ? digests.length : 0;
  } catch {}

  // 填充 UI
  const avatarEl = target.querySelector('#welcomeUserAvatar');
  const greetEl = target.querySelector('#welcomeGreeting');
  const lastLoginEl = target.querySelector('#welcomeLastLogin');
  const aiStyleEl = target.querySelector('#welcomeAiStyle');
  const creationsEl = target.querySelector('#welcomeCreations');
  const tipEl = target.querySelector('#welcomeTip');

  if (avatarEl) avatarEl.src = user.avatar || avatarEl.src;
  if (greetEl) greetEl.textContent = greet(user.nickname || '朋友');
  if (lastLoginEl) lastLoginEl.textContent = formatTime(user.last_login || Date.now());
  if (aiStyleEl) aiStyleEl.textContent = getAiStyle();
  if (creationsEl) creationsEl.textContent = String(digestsCount || 0);
  if (tipEl) tipEl.textContent = '今日提示：尝试使用不同的 AI 风格来获得更多样化的创作结果';

  // 显示块
  const block = target.querySelector('#welcomeUser');
  if (block) block.classList.remove('hidden');
}

// 模块导入即尝试自动挂载（Dashboard 页面）
try { if (document.getElementById('userWelcomeCard')) mountUserWelcomeCard(); } catch {}

export default { mountUserWelcomeCard };

// 中文注释：用户欢迎卡组件（恢复旧版设计样式与布局）
// 职责：
// - 从 public/components/card_userinfo.html 加载模板并挂载到容器
// - 读取本地用户信息与统计数据（Links/Subscriptions/Digests）并填充到模板
// - 在开发环境下提供稳健的容错与占位数据，避免页面中断

import storageAdapter from "../storage/storageAdapter.js";

/**
 * 挂载用户欢迎卡
 * @param {HTMLElement} container 容器元素（通常为 #userWelcomeCard）
 */
export async function mountUserWelcomeCard(container) {
  // 1) 容器检查（防御式）
  if (!container || !(container instanceof HTMLElement)) return;

  // 2) 加载 HTML 模板（public 目录作为站点根，dashboard.html 相对路径为 ./components/...）
  let html = "";
  try {
    const resp = await fetch("./components/card_userinfo.html", { cache: "no-store" });
    html = await resp.text();
  } catch (_) {
    // 容错：加载失败时提供极简占位（避免空白）
    html = `
      <div class="user-welcome-card rounded-xl border border-gray-200 p-6 bg-white">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <img id="welcomeUserAvatar" src="https://i.pravatar.cc/100?img=12" alt="User Avatar" class="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
          </div>
          <div class="flex-1 min-w-0">
            <div id="welcomeGreeting" class="text-xl font-semibold text-gray-800 mb-1"></div>
            <div class="text-sm text-gray-600 mb-3">
              <span>上次登录：</span>
              <span id="welcomeLastLogin" class="font-medium"></span>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div><span class="text-gray-600">AI 风格：</span><span id="welcomeAiStyle" class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"></span></div>
              <div><span class="text-gray-600">创作：</span><span id="welcomeCreations" class="font-medium text-blue-600">0</span><span class="text-gray-600">次</span></div>
              <div><span class="text-gray-600">提示：</span><span id="welcomeTip" class="text-xs text-gray-600">今日提示：尝试不同 AI 风格</span></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // 3) 注入模板到容器
  container.innerHTML = html;

  // 4) 读取用户与统计数据（均带有容错）
  const user = (storageAdapter.getUser && storageAdapter.getUser()) || {
    nickname: "Developer",
    avatar: "https://i.pravatar.cc/100?img=12",
    id: "local-dev",
  };

  let linksCount = 0;
  let subsCount = 0;
  let digestsCount = 0;
  try {
    const links = await (storageAdapter.getLinks ? storageAdapter.getLinks() : Promise.resolve([]));
    const subs = await (storageAdapter.getSubscriptions ? storageAdapter.getSubscriptions() : Promise.resolve([]));
    const digests = await (storageAdapter.getDigests ? storageAdapter.getDigests() : Promise.resolve([]));
    linksCount = Array.isArray(links) ? links.length : 0;
    subsCount = Array.isArray(subs) ? subs.length : 0;
    digestsCount = Array.isArray(digests) ? digests.length : 0;
  } catch (_) {}

  // 5) 填充模板中的元素内容
  const avatarEl = container.querySelector("#welcomeUserAvatar");
  const greetEl = container.querySelector("#welcomeGreeting");
  const lastLoginEl = container.querySelector("#welcomeLastLogin");
  const aiStyleEl = container.querySelector("#welcomeAiStyle");
  const creationsEl = container.querySelector("#welcomeCreations");
  const tipEl = container.querySelector("#welcomeTip");

  if (avatarEl) avatarEl.src = user.avatar || avatarEl.src;
  if (greetEl) greetEl.textContent = buildGreeting(user.nickname || "朋友");
  if (lastLoginEl) lastLoginEl.textContent = formatLastLogin(user.last_login || Date.now());
  if (aiStyleEl) aiStyleEl.textContent = getAiStyleLabel();
  if (creationsEl) creationsEl.textContent = String(digestsCount || 0);
  if (tipEl) tipEl.textContent = "今日提示：尝试使用不同的 AI 风格来获得更多样化的创作结果";

  // 6) 显示主块（模板默认 hidden）
  const block = container.querySelector("#welcomeUser");
  if (block) block.classList.remove("hidden");
}

// =========================
// 内部辅助函数（封装显示逻辑）
// =========================

function buildGreeting(name) {
  // 中文注释：根据时间段生成更自然的欢迎语
  try {
    const hour = new Date().getHours();
    const period = hour < 6 ? "凌晨" : hour < 11 ? "早上" : hour < 13 ? "中午" : hour < 18 ? "下午" : "晚上";
    return `欢迎回来，${name}（${period}好）`;
  } catch (_) {
    return `欢迎回来，${name}`;
  }
}

function formatLastLogin(ts) {
  // 中文注释：支持传入时间戳或 ISO 字符串，输出本地化的人类可读时间
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch (_) {
    return "刚刚";
  }
}

function getAiStyleLabel() {
  // 中文注释：AI 风格优先读取本地设置（若无则返回默认值）
  try {
    const raw = localStorage.getItem("rune_ai_style");
    const v = raw ? JSON.parse(raw) : null;
    const name = v?.name || v?.style || null;
    return name ? String(name) : "Creative";
  } catch (_) {
    return "Creative";
  }
}

export default { mountUserWelcomeCard };
