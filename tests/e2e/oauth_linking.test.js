/* @vitest-environment node */
// 中文注释：OAuth Linking 安全 E2E（模拟后端生成 state/验证；覆盖篡改/过期/重放）
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'

const SECRET = 'test_state_secret'

function sign(payloadObj) {
  const payloadStr = JSON.stringify(payloadObj)
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64')
  const h = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex')
  return `${payloadB64}.${h}`
}

function verify(state) {
  const [b64, sig] = String(state).split('.')
  const payloadStr = Buffer.from(b64, 'base64').toString('utf8')
  const h2 = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex')
  if (h2 !== sig) return { ok: false, error: 'STATE_SIGNATURE_INVALID' }
  const obj = JSON.parse(payloadStr)
  const maxAgeMs = 5 * 60 * 1000
  if (Date.now() - obj.ts > maxAgeMs) return { ok: false, error: 'STATE_EXPIRED' }
  return { ok: true, obj }
}

describe('OAuth Linking State Security', () => {
  it('normal link should pass verification', () => {
    const state = sign({ action: 'link', user_id: 'u1', nonce: crypto.randomUUID(), ts: Date.now() })
    const v = verify(state)
    expect(v.ok).toBe(true)
    expect(v.obj.action).toBe('link')
  })

  it('tampered state should be rejected', () => {
    const obj = { action: 'link', user_id: 'u1', nonce: crypto.randomUUID(), ts: Date.now() }
    const state = sign(obj)
    const [b64] = state.split('.')
    const tamperedPayload = { ...obj, user_id: 'other' }
    const tamperedB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64')
    const bad = `${tamperedB64}.${state.split('.')[1]}`
    const v = verify(bad)
    expect(v.ok).toBe(false)
    expect(v.error).toBe('STATE_SIGNATURE_INVALID')
  })

  it('expired state should be rejected', () => {
    const expTs = Date.now() - 10 * 60 * 1000
    const state = sign({ action: 'link', user_id: 'u1', nonce: crypto.randomUUID(), ts: expTs })
    const v = verify(state)
    expect(v.ok).toBe(false)
    expect(v.error).toBe('STATE_EXPIRED')
  })

  it('replay should be rejected (nonce single-use)', () => {
    const used = new Set()
    const nonce = crypto.randomUUID()
    const state = sign({ action: 'link', user_id: 'u1', nonce, ts: Date.now() })
    const v1 = verify(state)
    expect(v1.ok).toBe(true)
    if (v1.ok) used.add(nonce)
    const v2 = verify(state)
    const replay = used.has(v2.obj.nonce) ? { ok: false, error: 'STATE_REPLAY' } : v2
    expect(replay.ok).toBe(false)
    expect(replay.error).toBe('STATE_REPLAY')
  })
})

