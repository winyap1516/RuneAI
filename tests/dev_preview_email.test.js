/* @vitest-environment node */
// 中文注释：开发环境邮件预览测试（返回 preview_link 而非实际发送）

import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/js/services/api.js', () => {
  return {
    invokeJSON: vi.fn(async (name, opts = {}) => {
      if (name === 'request-recovery' && (opts.method || 'GET') === 'POST') {
        return { data: { sent: true, preview_link: 'https://supabase.local/functions/v1/confirm-recovery?token=abc&redirect=http%3A%2F%2Flocalhost%2Fset-password.html' }, error: null, status: 200 }
      }
      return { data: null, error: { message: 'NOT_IMPL' }, status: 500 }
    })
  }
})

describe('Dev Preview Emails', () => {
  it('request-recovery should return preview_link in dev mode', async () => {
    const { invokeJSON } = await import('../src/js/services/api.js')
    const resp = await invokeJSON('request-recovery', { method: 'POST', body: { identifier: 'x@y.com' } })
    expect(resp?.data?.sent).toBe(true)
    expect(String(resp?.data?.preview_link || '')).toContain('/confirm-recovery?token=')
  })
})
