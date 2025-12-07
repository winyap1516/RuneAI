#!/usr/bin/env node
/**
 * 简易敏感关键词扫描（中文注释）
 * 输出：
 *  - tmp/cleanup-output/secrets-scan.json
 *  - tmp/cleanup-output/sensitive-strings-report.json
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp', 'cleanup-output')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

let files = execSync('git ls-files', { encoding: 'utf-8' }).trim().split(/\r?\n/).filter(Boolean)
files = files.map(f => {
  if ((f.startsWith('"') && f.endsWith('"')) || (f.startsWith('\'') && f.endsWith('\''))) {
    return f.slice(1, -1)
  }
  return f
})

const SECRET_RE = /(AKIA[0-9A-Z]{16})|\bSECRET\b|\bPRIVATE\b|\bPASSWORD\b|\bTOKEN\b|service_role|mailPreview|preview/ig
const SENSITIVE_RE = /重发验证|仅限管理员|resend\s+verify|admin\s+only|mail\s+preview/ig

function scan(re, type) {
  const results = []
  for (const f of files) {
    const p = path.join(ROOT, f)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf-8')
    let m
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split(/\r?\n/).length
      const snippet = text.substring(m.index, Math.min(m.index + 120, text.length)).replace(/\r?\n/g, ' ')
      results.push({ file: f, line, snippet })
    }
  }
  return results
}

writeFileSync(path.join(OUT, 'secrets-scan.json'), JSON.stringify(scan(SECRET_RE, 'secret'), null, 2))
writeFileSync(path.join(OUT, 'sensitive-strings-report.json'), JSON.stringify(scan(SENSITIVE_RE, 'sensitive'), null, 2))
console.log('已生成 secrets-scan.json 与 sensitive-strings-report.json')
