# RuneAI – Subscription & Digest v0.1

> 说明：此文档为占位版本，后续将由主项目提供正式规范。

## 当前版本说明

- 使用 mock functions 模拟订阅与 Digest 生成流程
- 订阅数据与 Digest 数据暂存于浏览器 localStorage
- 近期会迁移到 Supabase 存储（采用 Edge Functions / Database）

## 设计概览（简述）

1. 订阅（Subscription）
   - 用户在卡片上点击 Subscribe 按钮创建订阅记录（`id/url/title/frequency/enabled/lastChecked`）
   - 订阅状态用于控制卡片右侧控件的可见性（例如“Generate Digest Now”）
   - 退订通过卡片右上角三点菜单进行

2. 摘要（Digest）
   - 支持将单站点内容写入当日合并 Digest（`merged=true`，按日期聚合）
   - Digest 项包含 entries（站点条目）、生成时间、站点数量等元信息

3. 本地开发
   - 通过 Vite 启动本地开发服务器
   - 环境变量示例位于 `.env.example`，真实值不应提交到仓库

> TODO：由主项目提供正式版本与详细数据结构/接口契约。
