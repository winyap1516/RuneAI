# Mock API 开发文档

## 概述
- 本地通过 Docker 部署独立的 Mock API 服务，提供 `/api` 前缀的端点，供前端联调与验收。
- 支持模拟延迟与错误（通过 query 参数）。

## 启动
1. 安装 Docker / Docker Compose
2. 在项目根目录执行：
   ```bash
   docker-compose up -d
   ```
3. 健康检查：
   ```bash
   curl http://localhost:4000/healthz
   ```

## 端点
- `GET /api/ai/digests`：返回 digest 列表
- `GET /api/ai/digests/:id`：返回指定 digest
- `POST /api/ai/digests/generate`：提交生成任务，返回 `job_id`
- `GET /api/jobs/:id`：查询生成任务状态
- `GET /api/subscriptions`：返回订阅列表
- `GET /api/cards`：返回卡片列表

## Fixtures
- 位置：`mock/fixtures/*.json`
  - `digests.json`、`cards.json`、`subscriptions.json`
- 容器以只读方式加载初始 fixture，并通过卷挂载映射为可写：`./mock/fixtures:/app/fixtures`

## 模拟错误/延迟
- 在任意请求追加 query 参数：
  - `?delay=800` → 延迟 800ms
  - `?error=500` → 返回 HTTP 500

示例：
```bash
curl "http://localhost:4000/api/ai/digests?delay=500"
curl "http://localhost:4000/api/cards?error=503"
```

## 前端切换
- 在 `.env` 设置：
  ```
  VITE_USE_MOCK=true
  VITE_MOCK_API_BASE=http://localhost:4000
  ```
- 影响：
  - `config.mockApiBase` 生效后，`apiRouter` 将导出 HTTP Mock 封装（优先级高于内置 mockService）
  - 不改动现有 UI 逻辑，可逐步替换为从 HTTP 读取数据

## 验证步骤（curl）
```bash
# 1) 拉起服务
docker-compose up -d

# 2) 读取 digests 列表
curl http://localhost:4000/api/ai/digests

# 3) 提交生成任务
curl -X POST http://localhost:4000/api/ai/digests/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":"local-dev","link_id":"ln-1001","mode":"manual"}'

# 4) 轮询任务状态（替换为上一步返回的 job_id）
curl http://localhost:4000/api/jobs/<job_id>

# 5) 读取 cards 与 subscriptions
curl http://localhost:4000/api/cards
curl http://localhost:4000/api/subscriptions
```

## 验收说明
- `docker-compose up -d` 能成功启动容器，端口 `4000` 可访问
- 所有端点按约定返回 JSON；`POST /generate` 能返回 `job_id`，且完成后可在 digests 列表看到新增项
- 支持 query 参数模拟错误与延迟
- 前端切换通过 `VITE_MOCK_API_BASE` 成功连通

