/* @vitest-environment node */
// 中文注释：恢复令牌生命周期单元测试
// 覆盖：request-recovery 创建 token、confirm-recovery 标记 used、set-password 更新密码
// 异常：重复使用（replay）、过期（expired）、篡改（tampered）

import { describe, it, expect, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// 中文注释：内存数据结构模拟后端表
const store = {
  tokens: [], // { user_id, token, context, expires_at, used, used_at, ip }
  audits: [], // { user_id, action, ip, details, ts }
  users: new Map(), // user_id -> { email, password }
}

function toHex(buf) {
  return Buffer.from(buf).toString('hex')
}

function nowIso() { return new Date().toISOString() }

// 中文注释：创建恢复令牌（1h）
function requestRecovery(user_id, ip) {
  const token = toHex(crypto.randomBytes(32))
  const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  store.tokens.push({ user_id, token, context: 'recovery', expires_at: exp, used: false, used_at: null, ip })
  store.audits.push({ user_id, action: 'request', ip, details: {}, ts: nowIso() })
  return token
}

// 中文注释：确认恢复令牌，颁发 set_password 令牌（15min）
function confirmRecovery(token, ip) {
  const row = store.tokens.find(t => t.token === token && t.context === 'recovery')
  if (!row) return { ok: false, error: 'TOKEN_NOT_FOUND' }
  if (row.used) return { ok: false, error: 'TOKEN_ALREADY_USED' }
  if (Date.now() > new Date(row.expires_at).getTime()) return { ok: false, error: 'TOKEN_EXPIRED' }
  row.used = true; row.used_at = nowIso()
  store.audits.push({ user_id: row.user_id, action: 'confirm', ip, details: { token_preview: token.slice(0,8)+'…' }, ts: nowIso() })
  const t2 = toHex(crypto.randomBytes(32))
  const exp2 = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  store.tokens.push({ user_id: row.user_id, token: t2, context: 'set_password', expires_at: exp2, used: false, used_at: null, ip })
  return { ok: true, token: t2 }
}

// 中文注释：设置密码（仅在 set_password 令牌下允许）
function setPassword(token, newPwd) {
  const row = store.tokens.find(t => t.token === token && t.context === 'set_password')
  if (!row) return { ok: false, error: 'TOKEN_NOT_FOUND' }
  if (row.used) return { ok: false, error: 'TOKEN_ALREADY_USED' }
  if (Date.now() > new Date(row.expires_at).getTime()) return { ok: false, error: 'TOKEN_EXPIRED' }
  const strong = newPwd.length >= 8 && /[A-Za-z]/.test(newPwd) && /\d/.test(newPwd)
  if (!strong) return { ok: false, error: 'PASSWORD_WEAK' }
  // 更新既有用户密码
  const user = store.users.get(row.user_id) || {}
  store.users.set(row.user_id, { ...user, password: newPwd })
  row.used = true; row.used_at = nowIso()
  store.audits.push({ user_id: row.user_id, action: 'create_password', ip: row.ip, details: { token_preview: token.slice(0,8)+'…' }, ts: nowIso() })
  return { ok: true }
}

describe('Recovery Token Lifecycle', () => {
  beforeEach(() => { store.tokens = []; store.audits = []; store.users.clear(); })

  it('should create recovery token, confirm it, and create set_password token', () => {
    const uid = 'u1'; const ip = '1.2.3.4'
    store.users.set(uid, { email: 'u1@example.com' })
    const t = requestRecovery(uid, ip)
    expect(typeof t).toBe('string')
    const c = confirmRecovery(t, ip)
    expect(c.ok).toBe(true)
    expect(typeof c.token).toBe('string')
  })

  it('confirm should mark recovery token used and reject replay', () => {
    const uid = 'u1'; const ip = '1.2.3.4'
    const t = requestRecovery(uid, ip)
    const c1 = confirmRecovery(t, ip)
    expect(c1.ok).toBe(true)
    const c2 = confirmRecovery(t, ip)
    expect(c2.ok).toBe(false)
    expect(c2.error).toBe('TOKEN_ALREADY_USED')
  })

  it('set-password should update password and reject tampered/expired/replay tokens', () => {
    const uid = 'u1'; const ip = '1.2.3.4'
    const t = requestRecovery(uid, ip)
    const { token: sp } = confirmRecovery(t, ip)
    const ok = setPassword(sp, 'Passw0rd123')
    expect(ok.ok).toBe(true)
    // replay
    const replay = setPassword(sp, 'Passw0rd456')
    expect(replay.ok).toBe(false)
    expect(replay.error).toBe('TOKEN_ALREADY_USED')
    // tampered
    const bad = setPassword(sp.slice(0, 10) + 'deadbeef', 'Passw0rd123')
    expect(bad.ok).toBe(false)
    expect(bad.error).toBe('TOKEN_NOT_FOUND')
    // expired
    const t2 = toHex(crypto.randomBytes(32))
    const past = new Date(Date.now() - 1000).toISOString()
    store.tokens.push({ user_id: uid, token: t2, context: 'set_password', expires_at: past, used: false, used_at: null, ip })
    const expRes = setPassword(t2, 'Passw0rd123')
    expect(expRes.ok).toBe(false)
    expect(expRes.error).toBe('TOKEN_EXPIRED')
  })
})

