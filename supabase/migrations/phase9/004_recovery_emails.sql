-- 中文注释：恢复邮箱表（recovery_emails）
-- 职责：记录用户绑定的备用邮箱及其验证状态，用于账户恢复
-- 安全：启用 RLS；仅 service_role 可写；用户仅可查看自身的恢复邮箱

create table if not exists public.recovery_emails (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  verified boolean not null default false,
  requested_at timestamptz not null default now(),
  verified_at timestamptz
);

create unique index if not exists recovery_emails_user_email_unique on public.recovery_emails(user_id, email);

alter table public.recovery_emails enable row level security;

-- 选择权限：仅本人可读
drop policy if exists recovery_emails_select on public.recovery_emails;
create policy recovery_emails_select on public.recovery_emails
  for select using (auth.uid() = user_id);

-- 写权限：仅允许 service_role 插入/更新/删除
drop policy if exists recovery_emails_write on public.recovery_emails;
create policy recovery_emails_write on public.recovery_emails
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

