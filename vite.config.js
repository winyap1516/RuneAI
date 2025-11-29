// Vite 开发服务器配置（固定端口为 5173）
// 说明：为避免不同端口导致 localStorage 同源数据不共享的问题，
// 这里将端口固定为 5173，并开启 strictPort 保证一致性。
import { defineConfig } from 'vite'

export default defineConfig({
  // 中文注释：基础路径设置
  // 目的：提升子路径部署与静态托管场景的稳健性，避免资源解析到站点根导致 404。
  // 规则：统一使用相对基础路径 './'。
  base: './',
  server: {
    port: 5173,
    strictPort: true, // 端口被占用时直接报错，不自动切换端口
  },
})