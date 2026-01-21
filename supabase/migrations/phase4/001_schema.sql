-- 中文注释：Phase 4 数据库与 RLS 策略（Supabase/Postgres）
-- 注意：请在本地/CI 中通过 Supabase CLI 应用迁移；生产环境请使用安全的环境变量

-- users（示例表，通常由 Supabase Auth 管理用户）
create table if not exists public.users (
  id uuid primary key,
  email text unique,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- links（原 websites，对应本地 links）
create table if not exists public.links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  url text not null,
  title text,
  description text,
  category text,
  tags jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists links_user_idx on public.links(user_id);
create index if not exists links_url_user_idx on public.links(url, user_id);

-- subscriptions
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  website_id uuid not null,
  frequency text check (frequency in ('daily','weekly') ),
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists subs_user_idx on public.subscriptions(user_id);
create index if not exists subs_website_user_idx on public.subscriptions(website_id, user_id);

-- digests
create table if not exists public.digests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  type text check (type in ('manual','daily') ),
  generated_at timestamptz default now(),
  entries jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists digests_user_idx on public.digests(user_id);

-- generation_logs（审计）
create table if not exists public.generation_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  website_id uuid,
  status text check (status in ('success','failed') ),
  error jsonb,
  created_at timestamptz default now()
);
create index if not exists genlogs_user_idx on public.generation_logs(user_id);

-- client_changes（客户端变更日志，幂等依赖唯一约束）
create table if not exists public.client_changes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  client_change_id text not null unique,
  resource_type text not null,
  resource_id uuid,
  op text check (op in ('create','update','delete') ),
  payload jsonb,
  client_ts timestamptz not null default now(),
  synced_at timestamptz,
  base_server_ts timestamptz,
  conflict_version int
);
create index if not exists client_changes_user_ts_idx on public.client_changes(user_id, client_ts);

-- RLS 策略：仅允许本人读写（user_id = auth.uid()）
alter table public.links enable row level security;
alter table public.subscriptions enable row level security;
alter table public.digests enable row level security;
alter table public.generation_logs enable row level security;
alter table public.client_changes enable row level security;

create policy links_select on public.links for select using (user_id = auth.uid());
create policy links_modify on public.links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy subs_select on public.subscriptions for select using (user_id = auth.uid());
create policy subs_modify on public.subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy digests_select on public.digests for select using (user_id = auth.uid());
create policy digests_modify on public.digests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy genlogs_select on public.generation_logs for select using (user_id = auth.uid());
create policy genlogs_insert on public.generation_logs for insert with check (user_id = auth.uid());

create policy changes_select on public.client_changes for select using (user_id = auth.uid());
create policy changes_modify on public.client_changes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

