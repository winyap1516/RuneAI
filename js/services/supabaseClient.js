// 中文注释：Supabase 客户端封装 (Phase 5: SDK 集成版)
// 作用：统一管理 Supabase 实例，使用官方 SDK 处理 Auth 与 API 交互
// 注意：需要 index.html / dashboard.html 引入 @supabase/supabase-js

import logger from './logger.js';
import { config } from './config.js';

const SUPABASE_URL = config.supabaseUrl;
function getAnonKey() { return config.supabaseAnonKey; }

try { config.validate(); } catch (e) { logger.error('[Config] 校验失败：', e.message); }

// 初始化 SDK 实例
// 注意：在 CDN 模式下，supabase 是挂载在 window 上的全局对象
let supabase = null;
// 中文注释：记录最近一次认证信息来源，便于 Sync 层打印失败上下文（仅 dev 环境使用）
let __lastAuthInfo = { source: 'unknown', preview: null };
// 中文注释：测试钩子（仅单元测试使用）用于覆盖内部方法，例如 getJWT，避免 ESM 导出绑定导致的 spy 无法生效问题
let __testHooks = { getJWT: null };
if (typeof window !== 'undefined' && window.supabase) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, getAnonKey(), {
            auth: {
                persistSession: true, // 自动持久化 Session (localStorage)
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        // 暴露实例供控制台调试
        window.supabaseClient = supabase;
        logger.info('[Supabase] Client initialized');
    } catch (e) {
        logger.error('[Supabase] Init failed:', e);
    }
} else {
    logger.warn('[Supabase] SDK not found on window. Ensure script is loaded in HTML.');
}

// 导出实例供其他模块使用
export { supabase };

/**
 * 获取当前会话（异步）
 * @returns {Promise<Object|null>} Session Object
 */
export async function getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/**
 * 获取当前用户
 * @returns {Promise<Object|null>} User Object
 */
export async function getUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
}

// 兼容旧版 API 的适配层

/**
 * 获取 JWT (Access Token)
 * @deprecated Phase 5 推荐直接使用 SDK 方法
 * @returns {Promise<string>} 注意：改为异步返回
 */
export async function getJWT() {
    const session = await getSession();
    return session?.access_token || '';
}

/**
 * 写入 JWT
 * @deprecated SDK 自动管理 Session，此方法不再推荐使用
 */
export function setJWT(token) {
    console.warn('[Supabase] setJWT is deprecated. SDK manages session automatically.');
}

/**
 * 判断是否已登录
 * @returns {Promise<boolean>} 注意：改为异步
 */
export async function isLoggedIn() {
    const session = await getSession();
    return !!session;
}

/**
 * 获取认证请求头 (异步)
 * @returns {Promise<Record<string,string>>}
 */
export async function getAuthHeaders() {
    // 中文注释：统一生成认证头（JWT-only）；生产环境严格禁止任何 fallback
    const headers = { 'Content-Type': 'application/json' };
    const isProd = typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.PROD) : false;
    const isDev = typeof import.meta !== 'undefined' ? (import.meta.env?.MODE !== 'production') : true;

    let source = 'none';
    // 中文注释：支持测试覆盖 getJWT，以便 Vitest 在 ESM 场景下稳定模拟返回值
    const getJWTImpl = typeof __testHooks.getJWT === 'function' ? __testHooks.getJWT : getJWT;
    let token = await getJWTImpl();

    // 中文注释：生产环境必须提供 JWT；否则直接抛错，阻止调用
    if (!token && isProd) {
        __lastAuthInfo = { source: 'none', preview: null };
        throw new Error('JWT_REQUIRED');
    }

    // 中文注释：开发环境可通过显式开关允许 fallback（兼容本地联调），默认关闭
    if (!token && isDev && typeof window !== 'undefined' && window.__ALLOW_DEV_AUTH_FALLBACK__) {
        try {
            // 1) 尝试从 localStorage 读取 SDK 会话（开发模式）
            let parsed = null;
            const direct = window.localStorage.getItem('supabase.auth.token');
            if (direct) {
                parsed = JSON.parse(direct);
            } else {
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                        const raw = window.localStorage.getItem(k);
                        parsed = raw ? JSON.parse(raw) : null;
                        if (parsed) break;
                    }
                }
            }
            if (parsed?.access_token) {
                token = parsed.access_token;
                source = 'localStorage';
            }
            // 2) 若仍无 Token，可作为最后兜底使用 anon key（仅 Dev 且显式启用）
            const ANON = getAnonKey();
            if (!token && ANON) {
                headers['Authorization'] = `Bearer ${ANON}`;
                const preview = ANON.slice(0, 8) + '…';
                __lastAuthInfo = { source: 'anon', preview };
                logger.warn('[AuthHdr] Dev fallback: using anon key');
                return headers;
            }
        } catch {}
    }

    // 中文注释：常规路径（JWT 存在）
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        const preview = String(token).slice(0, 8) + '…';
        __lastAuthInfo = { source: source === 'localStorage' ? 'localStorage' : 'SDK', preview };
    } else {
        // Dev 且未启用 fallback：不附带 Authorization，便于服务端返回 401
        __lastAuthInfo = { source: 'none', preview: null };
    }

    if (isDev) {
        logger.debug('[AuthHdr] source=', __lastAuthInfo.source, 'preview=', __lastAuthInfo.preview);
    }
    return headers;
}

/**
 * 调用 Edge Function (兼容旧版签名)
 * @param {string} name 
 * @param {RequestInit} init 
 */
export async function callFunction(name, init = {}) {
    // 中文注释：云端未就绪时直接跳过，避免浏览器报错（net::ERR_ABORTED）
    const ANON = getAnonKey();
    if (!SUPABASE_URL || !ANON || !supabase) {
        logger.warn('[EdgeFn] 云端未就绪，跳过调用：', name);
        // 返回一个可消费的空响应，防止上层逻辑崩溃
        return new Response(JSON.stringify({ skipped: true }), { status: 499, headers: { 'Content-Type': 'application/json' } });
    }
    const endpoint = `${SUPABASE_URL}/functions/v1/${name}`;
    // 获取 Headers (await)
    const authHeaders = await getAuthHeaders();
    // 中文注释：Supabase Edge Functions 推荐附带 apikey 头；同时保持 Authorization 为用户 JWT（若已登录）
    const headers = { ...(init.headers || {}), ...authHeaders, apikey: getAnonKey() };
    
    // Debug：打印来源与预览（仅 dev）
    const isDev = typeof import.meta !== 'undefined' ? (import.meta.env?.MODE !== 'production') : true;
    if (isDev) {
        logger.debug(`[EdgeFn] callFunction: ${name}`, { authSource: __lastAuthInfo.source, authPreview: __lastAuthInfo.preview });
    }
    
    return fetch(endpoint, { ...init, headers });
}

/**
 * 获取最近一次认证信息（供 Sync 层在失败时记录上下文）
 */
export function getLastAuthInfo() {
    return __lastAuthInfo;
}

/**
 * 调用 REST API (兼容旧版签名)
 */
export async function callRest(path, init = {}) {
    // 中文注释：云端未就绪时直接跳过 REST，避免报错
    const ANON = getAnonKey();
    if (!SUPABASE_URL || !ANON || !supabase) {
        logger.warn('[REST] 云端未就绪，跳过请求：', path);
        return new Response(JSON.stringify({ skipped: true }), { status: 499, headers: { 'Content-Type': 'application/json' } });
    }
    const endpoint = `${SUPABASE_URL}${path}`;
    const authHeaders = await getAuthHeaders();
    const headers = { ...(init.headers || {}), ...authHeaders, apikey: getAnonKey() || '' };
    logger.debug('[REST] callRest:', path, headers);
    return fetch(endpoint, { ...init, headers });
}

/**
 * 中文注释：云端可用性检测（URL + ANON_KEY + SDK 实例）
 */
export function isCloudReady() {
    return Boolean(SUPABASE_URL && getAnonKey() && supabase);
}

/**
 * 中文注释：设置测试钩子（仅用于 Vitest/单元测试）
 * 作用：允许覆盖内部方法（如 getJWT），避免 ESM 导出绑定导致 spyOn 对内部引用不生效
 * @param {{ getJWT?: () => (string|Promise<string>) }} hooks
 */
export function __setTestHooks(hooks = {}) {
    __testHooks = { ...__testHooks, ...hooks };
}

export default { supabase, getSession, getUser, getJWT, setJWT, isLoggedIn, getAuthHeaders, callFunction, callRest, __setTestHooks };
