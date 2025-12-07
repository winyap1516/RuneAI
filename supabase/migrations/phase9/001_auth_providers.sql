-- 中文注释：Phase 9 - OAuth Provider 绑定表（auth_providers）
-- 职责：将第三方 OAuth 身份（Google/Apple）绑定到现有邮箱用户，避免重复账号
-- 结构：user_id（FK auth.users.id）、provider_name、provider_user_id（外部唯一 ID）、provider_email、created_at
-- 安全：开启 RLS；仅 service_role 可插入；select 仅限本人；不允许前端更新/删除

create table if not exists public.auth_providers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null check (provider_name in ('google','apple')),
  provider_user_id text not null,
  provider_email text,
  created_at timestamptz default now()
);

-- 唯一约束：同一 provider 的外部用户 ID 全库唯一
create unique index if not exists auth_providers_unique on public.auth_providers(provider_name, provider_user_id);
create index if not exists auth_providers_user_idx on public.auth_providers(user_id);

-- 开启 RLS
alter table public.auth_providers enable row level security;

-- 选择策略：仅允许本人查看自己的绑定
drop policy if exists auth_providers_select on public.auth_providers;
create policy auth_providers_select on public.auth_providers
  for select using (user_id = auth.uid());

-- 插入策略：仅允许 service_role 插入（由 Edge Function 代为执行）
drop policy if exists auth_providers_insert on public.auth_providers;
create policy auth_providers_insert on public.auth_providers
  for insert with check (auth.role() = 'service_role');

-- 更新/删除策略：不开放（如需变更，另行提 PR 并实施审计）
-- 注意：service_role 默认可绕过 RLS，仍建议通过存储过程或 Edge Function 控制逻辑

