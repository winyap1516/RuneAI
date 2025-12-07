// 中文注释：config.validate 行为测试（条件化 FRONTEND_BASE_URL）
import { describe, it, expect } from 'vitest'
// 中文注释：统一到 src/js 路径
import configModule from '../src/js/services/config.js'

describe('Config validate', () => {
  it('should warn but not throw when VITE_FRONTEND_BASE_URL missing', () => {
    const cfg = configModule
    // 清空 FRONTEND_BASE_URL（模拟未设置）
    cfg.frontendBaseUrl = ''
    // 必要变量模拟存在
    cfg.supabaseUrl = 'https://example.supabase.co'
    cfg.supabaseAnonKey = 'anon_key_123'
    let threw = false
    try { cfg.validate() } catch (e) { threw = true }
    expect(threw).toBe(false)
  })
})
