-- 中文注释：账户恢复令牌表（account_recovery_tokens）
-- 职责：保存一次性令牌（token/nonce），支持两类上下文：'recovery'（验证邮箱链接）与 'set_password'（创建密码）
-- 安全：启用 RLS；仅 service_role 可写/读；令牌过期后不可使用；使用后立即标记 used

create table if not exists public.account_recovery_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  context text not null check (context in ('recovery','set_password')),
  nonce text,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  requested_ip text,
  created_at timestamptz not null default now()
);

create index if not exists account_recovery_tokens_user_idx on public.account_recovery_tokens(user_id);
create index if not exists account_recovery_tokens_expires_idx on public.account_recovery_tokens(expires_at);

alter table public.account_recovery_tokens enable row level security;

-- 仅允许 service_role 对该表进行所有操作
drop policy if exists account_recovery_tokens_all on public.account_recovery_tokens;
create policy account_recovery_tokens_all on public.account_recovery_tokens
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

