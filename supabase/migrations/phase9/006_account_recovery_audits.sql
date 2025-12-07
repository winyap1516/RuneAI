-- 中文注释：账户恢复审计表（account_recovery_audits）
-- 职责：记录恢复流程关键操作（request / confirm / create_password），便于安全追踪与问题排查
-- 安全：启用 RLS；仅 service_role 可插入；用户仅可查看自身记录

create table if not exists public.account_recovery_audits (
  id bigserial primary key,
  user_id uuid not null,
  email text,
  action text not null check (action in ('request','confirm','create_password')),
  client_req_id text,
  ip text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_recovery_audits_user_idx on public.account_recovery_audits(user_id);

alter table public.account_recovery_audits enable row level security;

-- 仅允许本人查看
drop policy if exists account_recovery_audits_select on public.account_recovery_audits;
create policy account_recovery_audits_select on public.account_recovery_audits
  for select using (auth.uid() = user_id);

-- 仅允许 service_role 插入
drop policy if exists account_recovery_audits_insert on public.account_recovery_audits;
create policy account_recovery_audits_insert on public.account_recovery_audits
  for insert with check (auth.role() = 'service_role');

