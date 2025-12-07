// 中文注释：getAuthHeaders 行为测试（DEV fallback 与 JWT）
// 说明：ESM 导出绑定导致 spyOn 对内部引用不生效，因此使用被测模块提供的 __setTestHooks 覆盖 getJWT
import { describe, it, expect } from 'vitest'
// 中文注释：统一到 src/js 路径
import * as client from '../src/js/services/supabaseClient.js'
import configModule from '../src/js/services/config.js'

describe('getAuthHeaders (dev)', () => {
  it('should return anon Authorization when no JWT and dev fallback enabled', async () => {
    // 开启 DEV fallback
    globalThis.window = globalThis.window || {}
    window.__ALLOW_DEV_AUTH_FALLBACK__ = true
    // 提供最小 localStorage stub（避免访问 undefined 抛错）
    window.localStorage = {
      getItem: () => null,
      key: () => null,
      length: 0,
      setItem: () => {}
    }
    // 模拟未登录（getJWT 返回空），通过测试钩子覆盖内部引用
    client.__setTestHooks({ getJWT: async () => '' })
    // 注入 anon key
    configModule.supabaseAnonKey = 'anon_key_ABCDEF'
    const headers = await client.getAuthHeaders()
    expect(headers.Authorization || '').toContain('anon_key_ABCDEF')
    // 恢复测试钩子
    client.__setTestHooks({ getJWT: null })
  })

  it('should include Bearer JWT when token exists', async () => {
    window.__ALLOW_DEV_AUTH_FALLBACK__ = false
    // 模拟已登录（返回 JWT），通过测试钩子覆盖内部引用
    client.__setTestHooks({ getJWT: async () => 'jwt_TOKEN_123456' })
    const headers = await client.getAuthHeaders()
    expect(headers.Authorization || '').toContain('jwt_TOKEN_123456')
    client.__setTestHooks({ getJWT: null })
  })
})
