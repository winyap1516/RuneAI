# Web Digest MVP 实施计划

## 现状核查（自动勾选）
- [x] Supabase 客户端统一封装：`js/services/supabaseClient.js`（含 `config.validate()`）
- [x] Digests 云表与本地存储、控制器与展示：`supabase/migrations/phase4/*`、`js/controllers/digestController.js`、`js/storage/db.js`、`js/views/digestView.js`
- [x] Edge Functions：`sync-push`/`sync-pull`/`super-endpoint` 已存在
- [x] 本地 Scheduler（Dev）：`js/main.js` 每 1 分钟轮询生成 Digest
- [ ] 发送通道（Telegram/WhatsApp）未实现
- [ ] 发送队列 `send_queue` 与日志 `send_logs` 未实现
- [ ] 专用生成接口（Edge `generate-digest`）与查询接口（`GET /digests`）未实现

## 总体架构
- 数据层：Postgres（Supabase）新增 `send_queue`、`send_logs`；沿用 `digests`、`subscriptions`、`generation_logs`。
- 后端层：新增 Edge Functions（`generate-digest`、`list-digests`、`enqueue-send`、`send-worker`）。所有接口强制 `Authorization: Bearer <JWT>` 与 RLS。
- 前端层：Digest 页面强化、订阅管理 UI（频道选择/目标填写/预览/手动发送）。
- 任务执行：使用 Supabase Scheduler 每 1 分钟触发 `send-worker`，或在 Dev 环境用本地轮询。

## 数据库迁移（SQL）
- 新增表并启用 RLS、索引与状态字段，遵循项目规则与命名。
```sql
-- send_queue：发送队列（指数退避 + 状态机）
create table if not exists public.send_queue (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  attempt int not null default 0,
  status text not null default 'queued', -- queued | processing | done | failed
  next_try timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists send_queue_status_idx on public.send_queue(status);
create index if not exists send_queue_next_try_idx on public.send_queue(next_try);

alter table public.send_queue enable row level security;
create policy send_queue_select on public.send_queue
  for select using (
    exists(select 1 from public.digests d where d.id = send_queue.digest_id and d.user_id = auth.uid())
  );
create policy send_queue_modify on public.send_queue
  for all using (
    exists(select 1 from public.digests d where d.id = send_queue.digest_id and d.user_id = auth.uid())
  );

-- send_logs：发送结果日志（审计用）
create table if not exists public.send_logs (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  channel text not null,
  target text not null,
  status text not null, -- success | failed
  response jsonb,
  created_at timestamptz not null default now()
);
create index if not exists send_logs_digest_idx on public.send_logs(digest_id);
create index if not exists send_logs_status_idx on public.send_logs(status);

alter table public.send_logs enable row level security;
create policy send_logs_select on public.send_logs
  for select using (
    exists(select 1 from public.digests d where d.id = send_logs.digest_id and d.user_id = auth.uid())
  );
create policy send_logs_insert on public.send_logs
  for insert with check (
    exists(select 1 from public.digests d where d.id = send_logs.digest_id and d.user_id = auth.uid())
  );
```

## 后端接口（Edge Functions）
- 统一要求：
  - 头部 `Authorization: Bearer <JWT>`，函数内部 `supabase.auth.getUser(jwt)` 校验。
  - 服务器侧使用 `SERVICE_ROLE_KEY` 初始化 Supabase 客户端；前端不持有密钥。

- `POST /generate-digest`（手动或 Scheduler 调用）
```ts
// supabase/functions/generate-digest/index.ts
// 说明：生成 Digest（支持手动 manual / 定时 scheduled），写入 digests 与 send_queue（满足条件时）
import { createClient } from '@supabase/supabase-js';

export async function handle(req: Request): Promise<Response> {
  // 中文注释：从请求头解析 JWT，并校验用户身份
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: user } = await sb.auth.getUser(jwt);
  if (!user?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const body = await req.json();
  const { user_id, mode = 'manual' } = body;
  if (user_id !== user.user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  // 中文注释：拉取该用户的 links（或 websites）
  const { data: links, error: linksErr } = await sb.from('links').select('*').eq('user_id', user_id);
  if (linksErr) return new Response(JSON.stringify({ error: linksErr.message }), { status: 500 });

  // 中文注释：生成摘要（开发用 Mock，生产可调用已有 super-endpoint 或真实 AI）
  const summary = `Mock 日报：您共有 ${links?.length ?? 0} 条收藏，示例摘要...`;

  // 中文注释：写入 digests（状态初始为 pending）
  const { data: inserted, error: insErr } = await sb
    .from('digests')
    .insert({ user_id, title: `日报 ${new Date().toLocaleDateString()}`, summary, status: 'pending', type: mode })
    .select()
    .single();
  if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });

  // 中文注释：判断订阅是否启用，满足条件则入队 send_queue
  const { data: subs } = await sb.from('subscriptions').select('*').eq('user_id', user_id).eq('enabled', true);
  const shouldEnqueue = mode === 'scheduled' || (subs && subs.length > 0);
  if (shouldEnqueue) {
    await sb.from('send_queue').insert({ digest_id: inserted.id });
  }

  return new Response(JSON.stringify({ ok: true, digest: inserted }), { headers: { 'Content-Type': 'application/json' } });
}
```

- `GET /digests?user_id=...&page=...&date=...`（网页展示历史）
```ts
// supabase/functions/list-digests/index.ts
// 说明：分页与日期筛选，返回 Supabase-like 结构 { data, error }
import { createClient } from '@supabase/supabase-js';

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: user } = await sb.auth.getUser(jwt);
  if (!user?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const user_id = url.searchParams.get('user_id');
  if (user_id !== user.user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');
  const date = url.searchParams.get('date');

  let q = sb.from('digests').select('*').eq('user_id', user_id).order('generated_at', { ascending: false });
  if (date) q = q.gte('generated_at', `${date} 00:00:00+00`).lte('generated_at', `${date} 23:59:59+00`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await q.range(from, to);

  return new Response(JSON.stringify({ data, error: error ? { message: error.message } : null }), { headers: { 'Content-Type': 'application/json' } });
}
```

- `POST /enqueue-send`（手动推送某条 digest）
```ts
// supabase/functions/enqueue-send/index.ts
// 说明：将指定 digest 写入 send_queue（仅本人）
import { createClient } from '@supabase/supabase-js';

export async function handle(req: Request): Promise<Response> {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: user } = await sb.auth.getUser(jwt);
  if (!user?.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const { digest_id } = await req.json();
  const { data: digest } = await sb.from('digests').select('id,user_id').eq('id', digest_id).single();
  if (!digest || digest.user_id !== user.user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });

  await sb.from('send_queue').insert({ digest_id });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
```

## Worker / Sender（后台）
- 触发方式：
  - 生产：Supabase Scheduler 每 1 分钟调用 `send-worker`。
  - 开发：本地 `node sendWorker.js` 或浏览器 Dev Scheduler（已存在）。

- `send-worker`（Edge Function 或 Serverless 脚本）
```ts
// supabase/functions/send-worker/index.ts
// 说明：处理队列，Telegram 发送，指数退避，写入 send_logs 与状态更新
import { createClient } from '@supabase/supabase-js';

async function sendTelegram(text: string, chatId: string) {
  // 中文注释：调用 Telegram Bot API 发送消息，控制速率 1 msg/s
  await new Promise(r => setTimeout(r, 1000));
  const resp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
  const json = await resp.json();
  return { ok: json.ok, response: json };
}

export async function handle(_req: Request): Promise<Response> {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: tasks } = await sb
    .from('send_queue')
    .select('*')
    .eq('status', 'queued')
    .or('next_try.is.null,next_try.lte.now()')
    .limit(10);

  for (const t of tasks ?? []) {
    await sb.from('send_queue').update({ status: 'processing' }).eq('id', t.id);
    try {
      const { data: digest } = await sb.from('digests').select('*').eq('id', t.digest_id).single();
      const { data: subs } = await sb.from('subscriptions').select('*').eq('user_id', digest.user_id).eq('enabled', true);

      let allOk = true;
      for (const s of subs ?? []) {
        if (s.channel === 'telegram') {
          const text = `【${digest.title}】\n\n${digest.summary}\n\n退订回复 /stop`;
          const { ok, response } = await sendTelegram(text, s.target_id);
          await sb.from('send_logs').insert({ digest_id: digest.id, channel: 'telegram', target: s.target_id, status: ok ? 'success' : 'failed', response });
          if (!ok) allOk = false;
        }
      }

      await sb.from('send_queue').update({ status: 'done' }).eq('id', t.id);
      if (allOk) await sb.from('digests').update({ status: 'success' }).eq('id', digest.id);
    } catch (err) {
      const attempt = (t.attempt ?? 0) + 1;
      const nextTry = new Date(Date.now() + Math.min(60000 * Math.pow(2, attempt - 1), 15 * 60 * 1000)).toISOString();
      await sb.from('send_queue').update({ attempt, status: attempt >= 3 ? 'failed' : 'queued', next_try: nextTry }).eq('id', t.id);
    }
  }

  return new Response(JSON.stringify({ ok: true }));
}
```

## 前端 / UX
- Digest 页面：
  - 卡片信息：标题、生成时间、summary 预览（≤300 字）、展开全文、关联 links 列表（可跳转）。
  - 操作区：`Generate Now` 按钮触发 `POST /generate-digest`；`Scheduler` 开关（每日 08:00），保存到 `subscriptions` 或用户设置。
  - 预览功能：调用 `list-digests` 获取最新一条，提供复制与“手动发送”按钮（`enqueue-send`）。

- 订阅管理 UI：
  - 频道选择（Telegram / WhatsApp / None）、目标填写（`chat_id` / `phone`）。
  - 展示 `consent_time` 与退订按钮（操作写 `subscriptions.enabled=false`）。

- 发送历史页：
  - 查询并展示 `send_logs`（success/fail），管理员或本人显示重试按钮（重新 `enqueue-send`）。

- 接口封装：在 `js/services/supabaseClient.js` 新增 `callFunction('generate-digest' | 'list-digests' | 'enqueue-send')` 的薄封装；UI 层仅调用封装。

## 环境变量与安全
- 新增：`TELEGRAM_BOT_TOKEN`（仅服务端使用，不暴露前端）。
- 文档：更新 `docs/ENV.md` 说明所有新增 env 与获取方式；仍由 `js/services/config.js` 做校验（前端只保留必要 `VITE_*`）。

## 测试与验证
- 单元测试：
  - 队列状态机（attempt/next_try/failed）。
  - Digest 生成（Mock AI 下的摘要与入库）。
- E2E 场景（5 个）：
  - Add Link → Generate Digest → Enqueue → Worker send → Telegram 接收 → send_logs 记录。
  - 手动发送失败 → 指数退避 → 第 3 次失败标记。
  - Scheduler 开启 → 每日 08:00 自动生成并入队。
  - 退订后 → 不再入队 → `send_logs` 不产生新记录。
  - 分页与日期筛选 → `list-digests` 正确返回。

## 文档与清单
- 更新：`docs/README.md`（本地运行/触发 Worker/查看 send_logs）、`docs/ARCHITECTURE.md`（新增模块与时序）、`docs/CHANGELOG.md`、`docs/ENV.md`。
- 更新《项目代码模块清单 (Code Module Blueprint).md》：记录 `send_queue`、`send_logs`、各 Edge Functions、前端新增视图与交互。

## 交付物列表
- Edge Functions：`generate-digest`、`list-digests`、`enqueue-send`、`send-worker`（含中文注释、可直接运行）。
- DB Migration SQL：`digests`（若差异即迁移补充）、`send_queue`、`send_logs`（含索引与 RLS）。
- 前端页面与组件：Digest 页面增强、Subscription UI、发送历史页与预览功能。
- README 与运行指南：env 配置、启动/触发 Worker、查看日志的步骤。

## 上线建议与风控
- 先只推送给测试用户，监控失败率，异常时暂停自动发送并人工复核。
- 发送速率限制（≥1 msg/s），避免被外部 API 限流。
- 设定发送配额（每天/每用户 X 条），日志保留至少 30 天。

——
准备就绪后我将按上述计划依次实现：先数据库迁移 → Edge Functions → Worker → 前端与文档，并在每步提供可运行代码与验证说明。