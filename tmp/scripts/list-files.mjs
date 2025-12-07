#!/usr/bin/env node
/**
 * 列出目录文件清单（含大小）
 * 目标目录：public/ 与 src/
 * 输出：tmp/cleanup-output/public-files.json, src-files.json
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'tmp', 'cleanup-output')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

function walk(dir) {
  const res = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      res.push(...walk(full))
    } else {
      const st = statSync(full)
      res.push({ path: path.relative(ROOT, full).replace(/\\/g, '/'), size: st.size })
    }
  }
  return res
}

const pubDir = path.join(ROOT, 'public')
const srcDir = path.join(ROOT, 'src')

writeFileSync(path.join(OUT_DIR, 'public-files.json'), JSON.stringify(walk(pubDir), null, 2))
writeFileSync(path.join(OUT_DIR, 'src-files.json'), JSON.stringify(walk(srcDir), null, 2))
console.log('已生成 public-files.json 与 src-files.json')
