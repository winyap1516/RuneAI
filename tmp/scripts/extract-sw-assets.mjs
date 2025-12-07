#!/usr/bin/env node
/**
 * 提取 Service Worker 中的 ASSETS_TO_CACHE 列表
 * 输出：tmp/cleanup-output/sw-assets-list.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'tmp', 'cleanup-output')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const swPath = path.join(ROOT, 'src', 'js', 'sw.js')
const text = readFileSync(swPath, 'utf-8')

// 中文注释：粗略解析 ASSETS_TO_CACHE 的字符串项
const m = text.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\]/)
let assets = []
if (m) {
  const body = m[1]
  const strRe = /['"]([^'"\n]+)['"]/g
  let s
  while ((s = strRe.exec(body)) !== null) {
    assets.push(s[1])
  }
}

const hasHtml = assets.some(a => /\.html(\?.*)?$/.test(a) || /\/components\//.test(a))
const report = { assets, comments: '仅列出字符串项；已忽略注释行', HTML_in_cache: hasHtml }

writeFileSync(path.join(OUT, 'sw-assets-list.json'), JSON.stringify(report, null, 2))
console.log('已生成 sw-assets-list.json')
