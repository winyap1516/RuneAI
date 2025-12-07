/* @vitest-environment node */
// 中文注释：Migration 内容校验（auth_providers 与审计表存在且包含关键约束）
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function read(file) {
  const p = path.resolve('supabase/migrations/phase9', file)
  return fs.readFileSync(p, 'utf-8')
}

describe('Migration - auth_providers', () => {
  it('should define auth_providers table and unique index', () => {
    const sql = read('001_auth_providers.sql')
    expect(sql).toMatch(/create table if not exists public\.auth_providers/i)
    expect(sql).toMatch(/provider_name\s+text\s+not null/i)
    expect(sql).toMatch(/provider_user_id\s+text\s+not null/i)
    expect(sql).toMatch(/create unique index[^\n]*auth_providers_unique[^\n]*on public\.auth_providers\(provider_name, provider_user_id\)/i)
    expect(sql).toMatch(/enable row level security/i)
    expect(sql).toMatch(/policy\s+auth_providers_insert[\s\S]*auth\.role\(\)\s*=\s*'service_role'/i)
  })
})

describe('Migration - auth_provider_audits', () => {
  it('should define auth_provider_audits table with policies', () => {
    const sql = read('002_auth_provider_audits.sql')
    expect(sql).toMatch(/create table if not exists public\.auth_provider_audits/i)
    expect(sql).toMatch(/action\s+text\s+not null\s+check \(action in \('link','login'\)\)/i)
    expect(sql).toMatch(/enable row level security/i)
    expect(sql).toMatch(/policy\s+auth_provider_audits_insert[\s\S]*auth\.role\(\)\s*=\s*'service_role'/i)
  })
})

