#!/usr/bin/env node
/**
 * 模板异步加载调用点扫描
 * 匹配关键字：fetch(、insertAdjacentHTML、innerHTML、response.text()、.load(
 * 输出 JSON：tmp/cleanup-output/template-loaders.json
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'tmp', 'cleanup-output')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const fileList = execSync('git ls-files "*.js"', { encoding: 'utf-8' })
  .trim().split(/\r?\n/).filter(Boolean)

const PATTERNS = [
  { name: 'fetch', re: /fetch\(\s*(['"])((?:[^'"\\]|\\.)+)\1\s*\)/g },
  { name: 'insertAdjacentHTML', re: /insertAdjacentHTML\s*\(/g },
  { name: 'innerHTML', re: /\.innerHTML\s*=\s*/g },
  { name: 'response.text', re: /response\.text\s*\(/g },
  { name: '.load', re: /\.load\s*\(/g }
]

const results = []
for (const file of fileList) {
  const abs = path.join(ROOT, file)
  if (!existsSync(abs)) continue
  const text = readFileSync(abs, 'utf-8')
  for (const p of PATTERNS) {
    let m
    while ((m = p.re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split(/\r?\n/).length
      const templateUrl = p.name === 'fetch' ? m[2] : null
      results.push({ caller_file: file, line, template_url: templateUrl, type: p.name })
    }
  }
}

writeFileSync(path.join(OUT_DIR, 'template-loaders.json'), JSON.stringify(results, null, 2))
console.log('已生成 template-loaders.json')
