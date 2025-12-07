// 中文注释：Vitest 全局测试前置脚本
// 目的：
// 1）为 JSDOM 环境注入 indexedDB（使用 fake-indexeddb）
// 2）为 Supabase 客户端提供 auth.getSession 的测试桩，避免 undefined 导致用例失败
// 3）在存在云端环境变量时，拦截 AI Edge Function 请求并返回标准化成功结构

import 'fake-indexeddb/auto'
import { vi } from 'vitest'
// 中文注释：禁用 AI 云端路径以强制走本地 Mock
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

// 中文注释：模块级 Supabase 客户端 Mock（仅覆盖所需方法）
vi.mock('../src/js/services/supabaseClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { app_metadata: { providers: ['google'] } } } } }),
        signInWithOAuth: async () => ({ data: { url: 'http://localhost/oauth' } }),
        signOut: async () => ({ data: {} }),
        updateUser: async () => ({ data: {}, error: null })
      },
      from: () => ({ delete: async () => ({ data: {}, error: null }), update: async () => ({ data: {}, error: null }) })
    }
  }
})

vi.mock('/src/js/services/supabaseClient.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { app_metadata: { providers: ['google'] } } } } }),
        signInWithOAuth: async () => ({ data: { url: 'http://localhost/oauth' } }),
        signOut: async () => ({ data: {} }),
        updateUser: async () => ({ data: {}, error: null })
      },
      from: () => ({ delete: async () => ({ data: {}, error: null }), update: async () => ({ data: {}, error: null }) })
    }
  }
})

// 中文注释：拦截全局 fetch，用测试数据模拟 Edge Function 响应
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = async (url, opts) => ({ ok: true, status: 200, json: async () => ({}) })
}
// 中文注释：如需模拟云端响应，可在单测内直接覆盖 __setTestHooks 或替换 fetch；此处不强制拦截
