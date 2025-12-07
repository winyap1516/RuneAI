-- 中文注释：OAuth Linking State 的一次性 Nonce 记录表
-- 职责：防止回放攻击（replay），每个 nonce 只能使用一次
-- 安全：仅 service_role 可插入/查询；启用 RLS

create table if not exists public.oauth_state_nonces (
  nonce text primary key,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.oauth_state_nonces enable row level security;

-- 插入/更新/选择仅限 service_role
drop policy if exists oauth_state_nonces_all on public.oauth_state_nonces;
create policy oauth_state_nonces_all on public.oauth_state_nonces
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

