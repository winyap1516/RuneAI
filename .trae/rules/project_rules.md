# 1. 项目目录结构（Project Structure）
src/js
  /features        # UI 功能模块（auth_ui, dashboard, digest, settings）
  /services        # Supabase、API、Config、Logger 等封装
  /sync            # Push/Pull 同步系统、冲突处理
  /controllers     # 页面逻辑与业务流程控制
  /views           # UI 视图渲染层
  /components      # 可复用 UI 组件（modals, cards…）
/supabase
  /functions       # Edge Functions
  /migrations      # 数据库迁移脚本
/tests             # 单元与端到端测试
/public            # 静态资源（modal, icons, manifest）

目录原则：单一职责、按功能区分、跨模块逻辑禁止堆叠。
# 2. 模块命名规范（Naming Convention）
类型	格式	示例
Feature 模块	*_ui.js	auth_ui.js
页面控制器	*_controller.js	digest_controller.js
服务层封装	*_service.js	supabase_service.js
组件	*_component.js	modal_conflict.js
同步逻辑	sync*.js	syncAgent.js
函数命名必须语义化：
fetchUser(), applyChanges(), pushToServer()
禁止：doStuff(), tmp(), xx1()

# 3. 环境变量 / 配置规范（Config Rules）
所有配置必须集中在：
src/js/services/config.js
在系统启动时执行 config.validate()
必须使用 .env
禁止在代码中硬编码 URL、keys、tokens
需要的变量必须写入：
.trae/documents/docs/ENV.md
必备环境变量（生产 / CI）
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY（仅 Edge/后端，不可出现在前端）
- OAUTH_STATE_SECRET
- FRONTEND_BASE_URL / VITE_FRONTEND_BASE_URL
- EMAIL_PROVIDER（sendgrid|ses|mailgun）
- EMAIL_API_KEY
- EMAIL_FROM
CI Secrets（仅后端使用的 key 必须加入 CI/CD secrets，不放仓库）
- SUPABASE_SERVICE_ROLE_KEY
- OAUTH_STATE_SECRET
- EMAIL_API_KEY

3.1 账号恢复与密码创建规范（Recovery & Password Creation Rules）
本章节描述用户在 无法通过 Google/Apple 等 OAuth 登录 时的账号恢复流程、一次性令牌规则、以及密码创建机制。
3.1.1 恢复入口（Unauthenticated Recovery Entry）
用户在登录失败时可访问：
/account-recovery.html
恢复入口 不需要登录，仅允许用户输入恢复邮箱（verified recovery email）。
系统统一返回 { sent: true }，不泄露邮箱是否存在。
3.1.2 恢复令牌（Recovery Token）
恢复流程使用一次性、短时有效的令牌：
类型：recovery_token
有效期：1 小时
字段：token、user_id、used、expires_at、ip、client_req_id
RLS：仅 service_role 可写入；用户不可读取
速率限制：同一 IP 15 分钟 ≥5 次 → 429
令牌使用后立即 used = true。
3.1.3 确认恢复（Confirm Recovery）
用户点击邮件中的恢复链接 → 调用：
/confirm-recovery (Edge Function)

服务端行为：
校验 token 状态（未用、未过期、未篡改）
标记 token 已用
生成二级令牌：set_password_token（有效期 15 分钟）
302 重定向到：
/set-password.html?token=<set_password_token>
3.1.4 设置密码（Set Password Flow）
该流程不可用于创建新用户，只能为已有 user_id 新增密码凭证。
规则：
强密码要求：≥8 字符，含字母 + 数字
令牌有效期：15 分钟
使用后标记 used
所有动作写入 account_recovery_audits
设置密码完成后，用户可使用 邮箱 + 密码登录，且仍保留 Google/Apple 登录方式。
3.1.5 邮箱角色（重要）
邮箱在本系统中的角色分为两类：
A）Recovery Email（恢复邮箱）
用户在 Settings 绑定
用于发送恢复邮件、确认恢复身份
不自动开启 email/password 登录（除非用户在恢复流程中主动设置密码）
B）Login Email（已创建密码后）
当用户成功完成 set-password 流程之后：
recovery email 自动升级为 login email
用户可通过 email/password 登录系统
此设计避免无意义的密码创建，也避免无意泄露用户邮箱是否存在。

3.1.6 审计要求（Audit Rules）
恢复相关的所有事件必须写审计：
recovery_request
recovery_confirm
recovery_token_expired
create_password
send_email_failed
throttled_by_rate_limit

审计字段必须包含：user_id（若可识别）、ip、client_req_id、provider、summary、ts。

3.1.7 安全规则（Security Requirements）
永不返回“邮箱不存在”之类的信息
所有令牌均为一次性，并在使用后立即标记 used
所有恢复请求只允许 apikey 调用（前端可安全调用）
service_role_key 永远不暴露给前端
所有邮件发送失败只写入审计，不向用户暴露细节

3.2 邮件服务环境变量（Email Provider Environment Variables）
邮件服务为恢复流程的组成部分，必须在 生产环境 / CI secrets 配置以下变量：
必需（生产）
EMAIL_PROVIDER — sendgrid | mailgun
EMAIL_API_KEY
EMAIL_FROM
可选：EMAIL_FROM_NAME（默认 Rune）
若 MAILGUN：MAILGUN_DOMAIN
Edge Functions 必需
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY（仅后端）
FRONTEND_BASE_URL

Dev 模式
开发环境无需真实发信：
系统自动返回 preview_link 用于端到端联调。
3.3 恢复流程验收标准（Recovery Acceptance Checklist）
用户可输入恢复邮箱并收到恢复链接（dev 显示 preview_link）
点击恢复链接成功跳到 /set-password.html
正确密码规则校验
能创建密码并用 email/password 登录；user_id 保持一致
令牌篡改、过期、重复使用 → 正确拒绝
审计记录完整
RATE LIMIT 生效（15 分钟 ≥5 次 → 429）

# 4. 安全规则（Security Rules）
4.1 Supabase Key
前端 只能使用 anon key
禁止任何 service_role_key 出现在仓库内，无论明文/加密
4.2 Edge Function 调用
所有请求必须包含：
Authorization: Bearer <JWT>
Edge Function 内部必须验证：
用户已登录
email_confirmed_at 已验证
角色正确（若需要管理员权限）

4.3 数据安全（RLS）
所有用户表必须启用 RLS
所有 insert/update/delete 必须通过 Supabase Auth 认证
禁止绕过 RLS 的 RPC unless verified

# 5. 同步系统规范（Sync Rules）
5.1 Push 协议
请求必须包含：
client_req_id  # 幂等性 token
changes[]      # 修改列表
modified_at    # 本地更新时间戳

5.2 Pull 协议
返回结构固定：

{
  applied: [],
  conflicts: [],
  skipped_due_to_idempotency: []
}

5.3 冲突处理流程
若返回 conflicts → 停止同步队列
打开 modal-conflict.js
用户选择：
Keep Local
Use Server
syncAgent 根据选择重新计算 patch → 继续 Push

# 6. 日志规范（Logging Rules）
必须使用唯一入口：
src/js/services/logger.js
禁止在功能模块中出现 console.log()。
必须记录：
user_id
client_req_id
操作类型
错误堆栈
冲突摘要

# 7. 文档更新规范（Documentation Rules）
文档必须实时跟随代码更新。
开发者或 AI 每次开发完成后必须更新：
文档	触发条件
README.md	新增功能、修改 UI 流程
ARCHITECTURE.md	修改架构、接口、同步、服务逻辑
CHANGELOG.md	添加功能、修复 Bug
ENV.md	新增/修改环境变量
CODE_MODULE_BLUEPRINT.md	新增文件/模块时必更新
规则：文档必须反映系统现实状态（代码为准 → 文档需同步更新）。

# 8. 模块清单维护规范（Blueprint Rules）
新增任何文件时必须写入《CODE_MODULE_BLUEPRINT.md》：
必须记录：
模块名称
所在路径
职责描述
输入/输出
依赖关系
哪些模块会调用它
若模块清单未更新，本次开发视为未完成。

# 9. 提交规范（Commit Rules）
格式建议：
feat: add dashboard digest cards
fix: correct logout redirection
docs: update sync architecture
refactor: split auth_ui logic
scope 可省略，不强制。

# 10. PR / Task 审核模版（Developer-Friendly）
每次提交必须包含：
Summary
该任务做了什么？为什么做？
Changed Files
列出文件路径
类型（新增 / 修改 / 删除）
Impact
会影响哪些功能？
是否需要文档或测试更新？
Manual Test Steps
逐步说明如何验证改动。
Screenshots / Logs（可选）
Docs Updated?
README
ARCHITECTURE
CHANGELOG
ENV.md
MODULE BLUEPRINT
测试与 Lint（PR Gate）
- 单元 / 全量测试：`npx vitest run`（或 `npm run test` 若已配置）
- 运行单测文件示例：`npx vitest run tests/account_settings_link.test.js`
- 静态路径校验：`npm run lint:paths`
- 可选：`npm run lint` / `npm run typecheck`（若已配置）

验收标准（Recovery 流程）
- 通过恢复流程后，用户可创建密码并用邮箱/密码登录，映射到原 `user_id`
- 篡改 / 重复使用 / 过期令牌均被拒绝并返回正确错误码
- 无已验证恢复邮箱时返回统一提示（引导人工流程）
- 审计记录包含 request / confirm / create_password，且速率限制生效（同 IP 15 分钟 ≥ 5 次触发限制）

邮件服务接入（Dev → Prod）
- 开发：开启“预览模式”（DEV 环境返回 preview_link，不实际发信；测试中断言 preview 内容）
- 生产：配置 SendGrid/SES/Mailgun；将邮箱模板（HTML+text）托管且启用事务型发送；将 `EMAIL_*` 写入 CI/CD secrets；合并后跑 smoke test 再切换全量发信

# 11. 项目进度（Milestone Tracker）

（AI 与开发者必须维护此区）
Phase	内容	状态
Phase 1	Auth 全链路	✔ 完成
Phase 2	Dashboard / Digest	进行中
Phase 3	Sync System	80% 完成
Phase 4	Local Supabase 联调	当前阶段
Phase 5	Billing / Quota	未开始

# 12. 未解决问题（Issue Radar）
（必须由 AI 与开发者保持最新）
Issue	描述	状态	优先级
#1	登出回 index.html 守卫回 login.html，不一致	未解决	High
#2	JWT fallback 安全风险	未解决	High
#3	Landing Modal 未挂载	未解决	Medium
#4	Base URL 校验过度严格	未解决	Medium
#5	modal_login.html 重复副本	未解决	Low

# 13. AI 自动写入规范（AI Update Protocol）
AI 在每次执行任务后必须将以下内容写入文档：
1. 变更记录（AI Change Log）
[日期时间]
Changed:
- 文件路径（新增/修改/删除）
Reason:
- 为什么需要做这个变更？
Impact:
- 是否影响 auth / sync / dashboard / edge functions？
Next Step:
- 还欠什么？

2. 若修改涉及 Issue，则更新 Issue 状态
示例：
Issue #1 → 已修复，原因：统一登出跳转到 login.html
3. 若新增模块 → 必须更新 Blueprint 清单
# 14. 人类开发者笔记区（可选）

