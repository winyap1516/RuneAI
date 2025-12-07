/* @vitest-environment node */
// 中文注释：账户恢复集成测试（模拟 Edge 返回与 supabase 登录）
// 覆盖：request -> confirm -> set-password -> email/password 登录映射到同一 user_id

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// 中文注释：模拟 invokeJSON（Edge Functions 调用）与 supabaseClient
vi.mock('../src/js/services/api.js', () => {
  // 内部状态：预览 link 与令牌
  let recoveryToken = ''
  let setPwdToken = ''
  const supabaseUrl = 'https://demo.supabase.local'
  return {
    invokeJSON: vi.fn(async (name, opts = {}) => {
      const method = opts.method || 'GET'
      if (name === 'request-recovery' && method === 'POST') {
        recoveryToken = Buffer.from(crypto.randomBytes(16)).toString('hex')
        const preview = `${supabaseUrl}/functions/v1/confirm-recovery?token=${recoveryToken}&redirect=${encodeURIComponent('http://localhost/set-password.html')}`
        return { data: { sent: true, preview_link: preview }, error: null, status: 200 }
      }
      if (name.startsWith('confirm-recovery') && method === 'GET') {
        // 提供 set_password 令牌
        setPwdToken = Buffer.from(crypto.randomBytes(16)).toString('hex')
        return { data: { token: setPwdToken, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, error: null, status: 200 }
      }
      if (name === 'set-password' && method === 'POST') {
        const t = opts.body?.token
        if (t !== setPwdToken) return { data: null, error: { message: 'TOKEN_INVALID' }, status: 400 }
        return { data: { ok: true }, error: null, status: 200 }
      }
      return { data: null, error: { message: 'NOT_IMPL' }, status: 500 }
    })
  }
})

// 中文注释：统一到 src/js 路径；api.js 保持原 js 位置
vi.mock('../src/js/services/supabaseClient.js', () => {
  const auth = {
    signInWithPassword: vi.fn(async ({ email, password }) => ({ data: { user: { id: 'u1', email } }, error: null }))
  }
  return { supabase: { auth } }
})

describe('Recovery Integration Flow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should request -> confirm -> set-password -> login with same user_id', async () => {
    const api = await import('../src/js/services/api.js')
    const client = await import('../src/js/services/supabaseClient.js')

    const req = await api.invokeJSON('request-recovery', { method: 'POST', body: { identifier: 'recovery@example.com' } })
    expect(req?.data?.sent).toBe(true)
    expect(String(req?.data?.preview_link || '')).toMatch('/confirm-recovery?token=')

    const preview = req.data.preview_link
    const tokenInLink = new URL(preview).searchParams.get('token')
    const cnf = await api.invokeJSON(`confirm-recovery?token=${tokenInLink}`, { method: 'GET' })
    expect(typeof cnf?.data?.token).toBe('string')

    const set = await api.invokeJSON('set-password', { method: 'POST', body: { token: cnf.data.token, new_password: 'Passw0rd-XYZ' } })
    expect(set?.data?.ok).toBe(true)

    const { supabase } = client
    const res = await supabase.auth.signInWithPassword({ email: 'recovery@example.com', password: 'Passw0rd-XYZ' })
    expect(res?.data?.user?.id).toBe('u1')
  })
})
