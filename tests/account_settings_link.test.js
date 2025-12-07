/* @vitest-environment jsdom */
// 中文注释：账号设置页面的 OAuth 链接流程测试（Link Google/Apple）
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模块模拟：supabaseClient 返回可控 supabase 实例
vi.mock('../src/js/services/supabaseClient.js', () => {
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u_test', email: 'u@test.com' } } }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {} })
  }
  return { supabase: { auth } }
})

import { mountAccountSettings } from '../src/js/features/account_settings.js'
import { supabase } from '../src/js/services/supabaseClient.js'

describe('Account Settings - OAuth Linking', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('click Link Google should call signInWithOAuth with action=link and state', async () => {
    const root = document.getElementById('root')
    mountAccountSettings(root)
    const btn = root.querySelector('#btnLinkGoogle')
    expect(btn).toBeTruthy()
    btn.click()
    // 等待异步流程执行
    await Promise.resolve()
    const calls = supabase.auth.signInWithOAuth.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const args = calls[0][0]
    expect(args.provider).toBe('google')
    const redirectTo = args.options.redirectTo
    expect(String(redirectTo)).toContain('action=link')
    expect(String(redirectTo)).toContain('state=')
  })
})
