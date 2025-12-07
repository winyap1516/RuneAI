-- 中文注释：OAuth Provider 绑定审计表（auth_provider_audits）
-- 职责：记录每次绑定与登录映射行为，便于后续合并重复用户与问题排查
-- 安全：启用 RLS；仅 service_role 可插入；用户仅可查看自身审计记录

create table if not exists public.auth_provider_audits (
  id bigserial primary key,
  caller_user_id uuid not null,
  target_user_id uuid,
  provider_name text not null check (provider_name in ('google','apple')),
  provider_user_id text not null,
  provider_email text,
  action text not null check (action in ('link','login')),
  state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_provider_audits_user_idx on public.auth_provider_audits(caller_user_id);
create index if not exists auth_provider_audits_target_idx on public.auth_provider_audits(target_user_id);

alter table public.auth_provider_audits enable row level security;

-- 仅允许本人查看（调用者或目标用户）
drop policy if exists auth_provider_audits_select on public.auth_provider_audits;
create policy auth_provider_audits_select on public.auth_provider_audits
  for select using (caller_user_id = auth.uid() or (target_user_id is not null and target_user_id = auth.uid()));

-- 仅允许 service_role 插入
drop policy if exists auth_provider_audits_insert on public.auth_provider_audits;
create policy auth_provider_audits_insert on public.auth_provider_audits
  for insert with check (auth.role() = 'service_role');

