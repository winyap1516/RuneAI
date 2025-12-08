# Mock Server — 真实 AI 集成

## 目标
- 在 Mock 环境下支持调用真实 OpenAI 生成 Digest 内容，前端无需改代码。
- 首次生成时写入 `mock/fixtures/digests.json` 进行缓存（回放复用）。

## 模式与开关
- `USE_REAL_AI=true|false`
  - `false`：完全静态 Mock（不调用 OpenAI）
  - `true`：若 fixtures 无对应 digest，调用 OpenAI 并写入缓存
- 依赖：`OPENAI_API_KEY`（必需，当 `USE_REAL_AI=true`）
- 可选：`OPENAI_MODEL`（默认 `gpt-4o-mini`）

## 启动（Docker Compose）
1. 在项目根创建 `.env`（Compose 环境）
   ```env
   USE_REAL_AI=true
   OPENAI_API_KEY=sk-xxxxxx
   OPENAI_MODEL=gpt-4o-mini
   ```
2. 启动服务：
   ```bash
   docker-compose up -d --build
   ```
3. 健康检查：
   ```bash
   curl http://localhost:4000/healthz
   ```

## API Contract（保持不变）
- `POST /api/ai/digests/generate`
  - 请求：`{ user_id, link_id, mode }`
  - 响应：`{ ok: true, job_id, status }`（`202 Accepted`）
  - 说明：
    - 若 `digests.json` 已存在该 `website_id` 的条目 → 直接完成（不调用 AI）
    - 若不存在且 `USE_REAL_AI=true` → 调用 OpenAI，写入缓存后完成
    - 若不存在且 `USE_REAL_AI=false` → 生成静态 Mock 摘要并写入缓存
- `GET /api/jobs/:id`
  - 响应：`{ ok: true, id, status, result?: { digest_id }, error?: string }`
- 其他端点：
  - `GET /api/ai/digests`
  - `GET /api/ai/digests/:id`
  - `GET /api/subscriptions`
  - `GET /api/cards`

## 验证示例（curl）
```bash
# 1) 提交生成任务（真实 AI 开启）
curl -X POST http://localhost:4000/api/ai/digests/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"local-dev","link_id":"ln-1001","mode":"manual"}'
# => { ok: true, job_id: "job_xxx", status: "processing" | "completed" }

# 2) 轮询作业状态（直到 completed）
curl http://localhost:4000/api/jobs/<job_id>
# => { ok: true, id, status: "completed", result: { digest_id: "dg_xxx" } }

# 3) 查看 digests 列表（已缓存）
curl http://localhost:4000/api/ai/digests
```

## 缓存与回放策略
- 缓存写入：`mock/fixtures/digests.json`
- 命中规则：按 `website_id`（即 `link_id`）匹配是否已有条目
- 回放：再次提交同一 `link_id` 的生成请求，会直接返回缓存中的 `digest_id`

## 延迟/错误模拟（调试）
- 任意端点追加：`?delay=800` 或 `?error=500`
- 示例：`curl "http://localhost:4000/api/cards?delay=500"`

## 前端切换（无需改代码）
- `.env`（Vite 环境）设置：
  ```
  VITE_USE_MOCK=true
  VITE_MOCK_API_BASE=http://localhost:4000
  ```
- 路由：`apiRouter` 优先使用 HTTP Mock，Links/Digest 视图操作保持不变

## 注意事项
- 本功能仅用于 dev/staging，严禁在生产环境传播或暴露密钥
- 若 `OPENAI_API_KEY` 未配置或错误，将自动回退为静态 Mock

```text
文件结构
mock/
  express/
    server.js
    Dockerfile
    package.json
  fixtures/
    digests.json
    cards.json
    subscriptions.json
```
