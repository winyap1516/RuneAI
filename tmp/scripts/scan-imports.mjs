#!/usr/bin/env node
/**
 * imports/duplicates 扫描脚本（中文注释）
 * 功能：
 * 1）扫描仓库中所有 JS/TS/HTML 引入语句（ESM import、CommonJS require、<script src>）
 * 2）规范化解析 import specifier，尝试解析为物理文件路径（resolved_path）
 * 3）生成两个报告文件：
 *    - tmp/cleanup-output/imports-report.json
 *    - tmp/cleanup-output/duplicate-modules.json（不同 specifier 指向同一物理文件的分组）
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// 中文注释：工作区根目录（与脚本运行位置一致）
const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'tmp', 'cleanup-output')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

// 中文注释：匹配规则
const JS_IMPORT_RE = /\bimport\s+[^;]*?from\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const CJS_REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
const HTML_SCRIPT_RE = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi

// 中文注释：列出目标文件（使用 git ls-files 保持与仓库一致）
const fileList = execSync(
  'git ls-files "*.js" "*.ts" "*.html" "*.mjs" "*.cjs"',
  { encoding: 'utf-8' }
).trim().split(/\r?\n/).filter(Boolean)

// 中文注释：别名解析（来自 vite.config.js 设置）
const aliasRules = [
  { from: /^\/src\/(.*)$/, to: (m) => path.join(ROOT, 'src', m[1]) },
  { from: /^src\/(.*)$/, to: (m) => path.join(ROOT, 'src', m[1]) }
]

// 中文注释：解析器——将 import specifier 解析为物理路径（尽可能）
function resolveSpecifier(spec, baseFile) {
  // 外部 URL 或裸模块：不解析为本地路径
  if (/^(https?:)?\/\//.test(spec)) return spec
  if (/^[^./]/.test(spec)) return spec // 裸模块（如 'vite'、'lodash'）

  // 应用别名规则（/src 或 src 前缀）
  for (const rule of aliasRules) {
    const m = spec.match(rule.from)
    if (m) return rule.to(m)
  }

  // 相对路径解析到绝对物理路径
  const baseDir = path.dirname(path.join(ROOT, baseFile))
  const abs = path.normalize(path.join(baseDir, spec))
  return abs
}

// 中文注释：扫描并收集结果
const imports = []
for (const file of fileList) {
  let absPath = path.join(ROOT, file)
  // 中文注释：兼容 git 路径异常（若缺少 public/ 前缀，则尝试补全）
  if (!existsSync(absPath) && !file.startsWith('public/')) {
    const candidate = path.join(ROOT, 'public', file)
    if (existsSync(candidate)) absPath = candidate
  }
  if (!existsSync(absPath)) {
    // 中文注释：文件不存在则跳过，避免脚本中断
    continue
  }
  const text = readFileSync(absPath, 'utf-8')
  const pushItem = (lineNo, spec, type) => {
    const resolved = resolveSpecifier(spec, file)
    imports.push({ file, line: lineNo, import_specifier: spec, resolved_path: resolved, type })
  }

  if (file.endsWith('.html')) {
    let m
    while ((m = HTML_SCRIPT_RE.exec(text)) !== null) {
      const spec = m[1]
      const lineNo = text.slice(0, m.index).split(/\r?\n/).length
      pushItem(lineNo, spec, 'html')
    }
    continue
  }

  // JS/TS 文件：ESM + CJS
  let m
  while ((m = JS_IMPORT_RE.exec(text)) !== null) {
    const spec = m[1] || m[2]
    if (!spec) continue
    const lineNo = text.slice(0, m.index).split(/\r?\n/).length
    pushItem(lineNo, spec, 'esm')
  }
  while ((m = CJS_REQUIRE_RE.exec(text)) !== null) {
    const spec = m[1]
    const lineNo = text.slice(0, m.index).split(/\r?\n/).length
    pushItem(lineNo, spec, 'cjs')
  }
}

// 中文注释：写入 imports 报告
writeFileSync(path.join(OUT_DIR, 'imports-report.json'), JSON.stringify(imports, null, 2))

// 中文注释：生成 duplicate-modules 分组（仅针对解析为本地物理路径的项）
const groups = {}
for (const it of imports) {
  // 仅当 resolved_path 指向本地文件且存在时参与分组
  if (/^([a-zA-Z]:)?\\|\//.test(it.resolved_path) && existsSync(it.resolved_path)) {
    const key = path.normalize(it.resolved_path)
    if (!groups[key]) groups[key] = new Set()
    groups[key].add(it.import_specifier)
  }
}
const dupReport = Object.entries(groups)
  .filter(([_, specs]) => specs.size > 1)
  .map(([resolved_path, specs]) => ({ resolved_path, specifiers: Array.from(specs).sort() }))

writeFileSync(path.join(OUT_DIR, 'duplicate-modules.json'), JSON.stringify(dupReport, null, 2))

console.log(`已生成 ${path.join(OUT_DIR, 'imports-report.json')} 与 duplicate-modules.json`) 
