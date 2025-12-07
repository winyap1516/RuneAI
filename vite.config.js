// Vite 开发服务器配置（固定端口为 5173）
// 说明：为避免不同端口导致 localStorage 同源数据不共享的问题，
// 这里将端口固定为 5173，并开启 strictPort 保证一致性。
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  // 中文注释：指定构建与开发的根目录为 `public`
  // 目的：项目的 HTML 文件位于 `public/` 下（如 index.html、dashboard.html 等），
  //      将 root 设置为 `public` 可修复 `vite build` 在项目根找不到 index.html 的问题。
  // 注意：设置为 `public` 后，默认的 `publicDir` 会变为 `public/public`，因此需要显式关闭。
  root: 'public',
  // 中文注释：显式指定环境变量目录为项目根，确保读取根目录下的 .env（而非 public/.env）
  envDir: path.resolve(process.cwd()),
  // 中文注释：基础路径设置
  // 目的：提升子路径部署与静态托管场景的稳健性，避免资源解析到站点根导致 404。
  // 规则：统一使用相对基础路径 './'。
  base: './',
  // 中文注释：关闭 Vite 的内置 public 目录拷贝逻辑
  // 原因：我们已将项目的静态与 HTML 直接置于 `public/`，无需额外的 `publicDir` 拷贝。
  publicDir: false,
  // 中文注释：多页面构建与额外文件（Service Worker）
  // 说明：显式声明输入入口，确保 `sw.js` 与各页面被打包输出至 dist。
  build: {
    rollupOptions: {
      input: {
        // 中文注释：使用绝对路径更稳健，避免 Rollup 解析相对根的歧义
        index: path.resolve(process.cwd(), 'public/index.html'),
        dashboard: path.resolve(process.cwd(), 'public/dashboard.html'),
        login: path.resolve(process.cwd(), 'public/login.html'),
        register: path.resolve(process.cwd(), 'public/register.html'),
        signup: path.resolve(process.cwd(), 'public/signup.html'),
        oauth: path.resolve(process.cwd(), 'public/oauth-callback.html'),
        resetpwd: path.resolve(process.cwd(), 'public/reset-password.html'),
        setpwd: path.resolve(process.cwd(), 'public/set-password.html'),
        recovery: path.resolve(process.cwd(), 'public/account-recovery.html'),
        // 中文注释：将 Service Worker 入口设置为源码路径，便于控制输出文件名
        sw: path.resolve(process.cwd(), 'src/js/sw.js')
      },
      output: {
        // 中文注释：将 SW 输出为顶层文件 `dist/sw.js`，确保注册路径可用
        entryFileNames: (chunk) => chunk.name === 'sw' ? '[name].js' : 'assets/[name]-[hash].js'
      }
    }
  },
  // 中文注释：路径解析别名（修复 HTML 中对 /src/* 的引用）
  // 说明：在 root=public 的模式下，HTML `<script src="../src/...">` 会被重写为 `/src/...`。
  //       这里将 `src` 映射到工作区真实源码目录，确保解析到 D:/RuneAI/src。
  resolve: {
    alias: {
      '/src': path.resolve(process.cwd(), 'src'),
      'src': path.resolve(process.cwd(), 'src')
    }
  },
  server: {
    // 中文注释：在 IDE 预览环境下禁用 HMR，避免 WebSocket 被代理阻断导致的报错
    host: true, // 允许通过局域网访问（0.0.0.0）
    port: 5173,
    strictPort: true, // 端口被占用时直接报错，不自动切换端口
    hmr: false,
    // 中文注释：允许从 `public/` 根跨目录访问工作区 `src/` 源码
    // 原因：当前项目将 HTML 放在 `public/`，源码在 `src/`；Vite 在严格 FS 模式下默认禁止跨根访问。
    // 修复：显式加入绝对路径，确保诸如 `../src/js/main.js` 与其内部相对导入（如 `../views/sendLogsView.js`）均可解析。
    fs: { strict: false, allow: [
      // 允许整个工作区（用于静态资产与 HTML）
      path.resolve(process.cwd()),
      // 允许源码目录（用于模块导入）
      path.resolve(process.cwd(), 'src')
    ] }
  },
  // 中文注释：Vitest 测试配置（由于 root=public，需显式包含上层 tests 目录）
  // 说明：默认扫描范围会受 root 影响，导致无法找到位于项目根的 tests/* 测试文件。
  // 修复：将 include 指向 public 上层的 tests 目录，保持现有测试结构不变。
  test: {
    include: [
      '../tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../tests/**/*.e2e.test.{c,m,}{j,t}s' // 兼容 e2e 命名
    ],
    environment: 'jsdom',
    globals: true,
    setupFiles: [
      '../tests/setup.vitest.js'
    ]
  }
})
