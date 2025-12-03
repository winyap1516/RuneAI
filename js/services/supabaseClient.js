// 中文注释：Supabase 客户端封装 (Phase 5: SDK 集成版)
// 作用：统一管理 Supabase 实例，使用官方 SDK 处理 Auth 与 API 交互
// 注意：需要 index.html / dashboard.html 引入 @supabase/supabase-js

import logger from './logger.js';
import { config } from './config.js';

const SUPABASE_URL = config.supabaseUrl;
const SUPABASE_ANON_KEY = config.supabaseAnonKey;

try { config.validate(); } catch (e) { logger.error('[Config] 校验失败：', e.message); }

// 初始化 SDK 实例
// 注意：在 CDN 模式下，supabase 是挂载在 window 上的全局对象
let supabase = null;
if (typeof window !== 'undefined' && window.supabase) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true, // 自动持久化 Session (localStorage)
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
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
    const token = await getJWT();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (SUPABASE_ANON_KEY) {
        headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }
    return headers;
}

/**
 * 调用 Edge Function (兼容旧版签名)
 * @param {string} name 
 * @param {RequestInit} init 
 */
export async function callFunction(name, init = {}) {
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL 未配置');
    const endpoint = `${SUPABASE_URL}/functions/v1/${name}`;
    // 获取 Headers (await)
    const authHeaders = await getAuthHeaders();
    const headers = { ...(init.headers || {}), ...authHeaders };
    logger.debug('[EdgeFn] callFunction:', name, headers);
    return fetch(endpoint, { ...init, headers });
}

/**
 * 调用 REST API (兼容旧版签名)
 */
export async function callRest(path, init = {}) {
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL 未配置');
    const endpoint = `${SUPABASE_URL}${path}`;
    const authHeaders = await getAuthHeaders();
    const headers = { ...(init.headers || {}), ...authHeaders, apikey: SUPABASE_ANON_KEY || '' };
    logger.debug('[REST] callRest:', path, headers);
    return fetch(endpoint, { ...init, headers });
}

export default { supabase, getSession, getUser, getJWT, setJWT, isLoggedIn, getAuthHeaders, callFunction, callRest };
