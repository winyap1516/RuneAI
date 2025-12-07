-- 发送队列与日志：数据库迁移（遵循项目 RLS、安全与索引规范）
-- 中文注释：本文件创建 send_queue 与 send_logs 两张表，并设置必要索引与 RLS 策略。

-- ==========================
-- send_queue：发送队列
-- 字段含义：
--  - digest_id：关联到 digests，表示要发送的摘要条目
--  - attempt：当前重试次数
--  - status：队列状态（queued | processing | done | failed）
--  - next_try：下一次重试时间（用于指数退避策略）
--  - created_at：创建时间
-- ==========================
create table if not exists public.send_queue (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  attempt int not null default 0,
  status text not null default 'queued',
  next_try timestamptz,
  created_at timestamptz not null default now()
);

-- 索引：提高查询效率（按状态与时间）
create index if not exists send_queue_status_idx on public.send_queue(status);
create index if not exists send_queue_next_try_idx on public.send_queue(next_try);

-- 启用 RLS：所有访问需满足所属用户数据范围
alter table public.send_queue enable row level security;

-- 选择策略：只能选择自己所属的 digest 队列项
create policy send_queue_select on public.send_queue
  for select using (
    exists(
      select 1 from public.digests d
      where d.id = public.send_queue.digest_id and d.user_id = auth.uid()
    )
  );

-- 修改策略：只能修改自己所属的队列项
create policy send_queue_modify on public.send_queue
  for all using (
    exists(
      select 1 from public.digests d
      where d.id = public.send_queue.digest_id and d.user_id = auth.uid()
    )
  );

-- ==========================
-- send_logs：发送结果日志
-- 字段含义：
--  - digest_id：关联到 digests
--  - channel：发送渠道（telegram / whatsapp / ...）
--  - target：目标标识（如 chat_id / phone）
--  - status：success / failed
--  - response：外部 API 返回（JSON）
--  - created_at：创建时间
-- ==========================
create table if not exists public.send_logs (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.digests(id) on delete cascade,
  channel text not null,
  target text not null,
  status text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

-- 索引：按 digest 与状态查询
create index if not exists send_logs_digest_idx on public.send_logs(digest_id);
create index if not exists send_logs_status_idx on public.send_logs(status);

-- 启用 RLS
alter table public.send_logs enable row level security;

-- 选择策略：只能查看自己所属的 digest 的日志
create policy send_logs_select on public.send_logs
  for select using (
    exists(
      select 1 from public.digests d
      where d.id = public.send_logs.digest_id and d.user_id = auth.uid()
    )
  );

-- 插入策略：只能为自己所属的 digest 写日志
create policy send_logs_insert on public.send_logs
  for insert with check (
    exists(
      select 1 from public.digests d
      where d.id = public.send_logs.digest_id and d.user_id = auth.uid()
    )
  );

