// 中文注释：轻量静态校验脚本
// 目标：在构建/预览前扫描以下违规项：
// 1) components/ 目录下的 HTML 文件中存在 <script> 标签
// 2) 项目内存在以 '/js/' 开头的绝对路径导入/引用
// 使用：在 package.json 的 scripts 中添加 "lint:paths": "node scripts/check_static_paths.js"

import fs from 'fs';
import path from 'path';

const root = process.cwd();

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, exts));
    else {
      if (!exts || exts.includes(path.extname(full))) out.push(full);
    }
  }
  return out;
}

function stripHtmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '');
}

function checkComponentsScripts() {
  const compDir = path.join(root, 'components');
  if (!fs.existsSync(compDir)) return [];
  const htmls = walk(compDir, ['.html']);
  const problems = [];
  for (const file of htmls) {
    const raw = fs.readFileSync(file, 'utf-8');
    const content = stripHtmlComments(raw);
    // 中文注释：逐段查找 <script>...<\/script>，避免误报（如文本或注释内）
    let idx = 0;
    while (true) {
      const openIdx = content.indexOf('<script', idx);
      if (openIdx === -1) break;
      const closeIdx = content.indexOf('</script>', openIdx);
      if (closeIdx !== -1) {
        // 记录违规片段，便于调试定位
        const snippet = content.substring(openIdx, Math.min(closeIdx + 9, openIdx + 200)).replace(/\n/g, ' ');
        problems.push({ file, rule: 'components-no-script', msg: '组件 HTML 禁止包含 <script> 标签', snippet });
        idx = closeIdx + 9;
      } else {
        // 没有闭合标签则继续查找，避免死循环
        idx = openIdx + 7;
      }
    }
  }
  return problems;
}

function checkAbsoluteJsPaths() {
  const exts = new Set(['.html', '.js', '.ts', '.css', '.vue', '.svelte']);
  const all = walk(root);
  const problems = [];
  const re = /['"`]\/js\//g; // 匹配以 /js/ 开头的绝对路径
  for (const file of all) {
    const ext = path.extname(file);
    if (file.includes('node_modules') || file.includes('scripts') || !exts.has(ext)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    if (re.test(content)) {
      problems.push({ file, rule: 'no-absolute-js', msg: '禁止以 /js/ 开头的绝对路径' });
    }
  }
  return problems;
}

function main() {
  const problems = [
    ...checkComponentsScripts(),
    ...checkAbsoluteJsPaths(),
  ];
  if (problems.length) {
    console.error('\n静态路径校验失败：');
    for (const p of problems) {
      const extra = p.snippet ? `\n    片段：${p.snippet}` : '';
      console.error(`- [${p.rule}] ${p.file} -> ${p.msg}${extra}`);
    }
    process.exit(1);
  } else {
    console.log('静态路径校验通过 ✅');
  }
}

main();