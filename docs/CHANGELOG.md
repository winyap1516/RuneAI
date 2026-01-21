# 更新日志 (Changelog)

## 2025-12-09
- **文档同步**：
  - ARCHITECTURE：新增数据流与安全边界
  - ENV：变量与 Secrets 清单
  - BLUEPRINT：模块职责与依赖（补充 sync-push/pull）
  - README：联调样例与排错
- **功能修复与优化**：
  - LinkController：分离 Cloud Sync 与 AI Generate 逻辑，避免 Sync 失败阻塞 AI；增加 SDK Fallback 详细日志。
  - Edge Functions：`update-link` 支持 `ai_status` 字段同步；`delete-link` 增加 `user_id` 过滤。
  - UI：
    - 修复 Favicon 多级回退显示。
    - 修复订阅按钮状态切换逻辑。
    - **修复 Edit 菜单 URL 为空问题**：增加 DOM 回退机制，当数据源 URL 丢失时尝试从卡片 DOM 获取。
    - 优化卡片模板：增加 `data-url` 与 `card-link` 类以便于数据回溯。
  - 安全：强化 RLS 策略，增加 Edge Function 回退机制处理 0 行受影响情况。

## 待办 (TODO)
- [ ] 验证后端 Edge Function 部署后 `ai_status` 同步情况（依赖实际部署）
- [ ] 完善 PowerShell 一键部署脚本
