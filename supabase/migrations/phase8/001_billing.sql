-- 中文注释：计费与用户额度模块迁移（Phase 8）
-- 目标：新增 plans / purchases / user_quotas / app_settings / stripe_events，并开启 RLS 与策略
-- 安全：所有额度与财务相关写入仅由后端 Edge Functions 执行；前端仅读取与受控调用

-- 可选：全局默认设置（默认每日生成次数）
create table if not exists public.app_settings (
  id text primary key default 'global',
  default_daily_limit int not null default 5,
  created_at timestamptz not null default now()
);

insert into public.app_settings (id, default_daily_limit)
values ('global', 5)
on conflict (id) do nothing;

-- 用户额度表：可覆盖全局；支持一次性额外额度（extra_credits）
create table if not exists public.user_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_limit int not null,
  extra_credits int default 0,
  updated_at timestamptz not null default now()
);

create index if not exists ix_user_quotas_user_id on public.user_quotas(user_id);

-- 付费计划表：定义授权数量与价格，支持订阅或一次性
create table if not exists public.plans (
  id text primary key, -- 例如："one-off-50"、"monthly-100"
  title text,
  description text,
  grant_amount int not null, -- 购买后授予的次数
  price_cents int not null,
  currency text not null default 'usd',
  recurring boolean default false,
  stripe_price_id text,
  active boolean default true,
  created_at timestamptz not null default now()
);

-- 购买记录表：记录用户购买状态与发放行为
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount int, -- 价格（分）
  currency text,
  status text check (status in ('pending','succeeded','failed','refunded')),
  stripe_payment_intent text,
  refund_status text, -- 中文：退款标记（flagged/processed），默认由人工处理
  stripe_refund_id text, -- 中文：记录退款标识，便于追溯与审计
  created_at timestamptz not null default now()
);

create index if not exists ix_purchases_user on public.purchases(user_id);
create index if not exists ix_purchases_plan on public.purchases(plan_id);

-- 幂等事件表：记录已处理的 Stripe 事件，避免重复处理
create table if not exists public.stripe_events (
  id bigserial primary key,
  event_id text not null unique,
  type text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- 开启 RLS
alter table public.user_quotas enable row level security;
alter table public.purchases enable row level security;
alter table public.plans enable row level security;

-- RLS 策略：user_quotas
-- 普通用户：仅能查询自己的额度
drop policy if exists user_quota_select_own on public.user_quotas;
create policy user_quota_select_own on public.user_quotas
  for select
  using (auth.uid() = user_id);

-- 管理员：允许查询所有与写入（通过 JWT claims: role='admin'）
drop policy if exists user_quota_admin_all on public.user_quotas;
create policy user_quota_admin_all on public.user_quotas
  for all
  using (current_setting('jwt.claims.role', true) = 'admin')
  with check (current_setting('jwt.claims.role', true) = 'admin');

-- 禁止普通用户写入 user_quotas（所有写入由 Edge Functions 校验 admin 并执行）
drop policy if exists user_quota_user_update_self on public.user_quotas;

-- RLS 策略：purchases
-- 用户：查询自己的购买记录
drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own on public.purchases
  for select
  using (auth.uid() = user_id);

-- 用户：可插入 pending 记录（可选，若走前端触发本地 pending）
drop policy if exists purchases_insert_pending on public.purchases;
create policy purchases_insert_pending on public.purchases
  for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );

-- 管理员：允许管理所有购买记录
drop policy if exists purchases_admin_all on public.purchases;
create policy purchases_admin_all on public.purchases
  for all
  using (current_setting('jwt.claims.role', true) = 'admin')
  with check (current_setting('jwt.claims.role', true) = 'admin');

-- RLS 策略：plans
-- 已登录用户均可阅读可售计划
drop policy if exists plans_select_active on public.plans;
create policy plans_select_active on public.plans
  for select
  using (
    coalesce(current_setting('jwt.claims.sub', true), '') <> '' and active = true
  );

-- 管理员可管理计划
drop policy if exists plans_admin_all on public.plans;
create policy plans_admin_all on public.plans
  for all
  using (current_setting('jwt.claims.role', true) = 'admin')
  with check (current_setting('jwt.claims.role', true) = 'admin');

-- 初始计划种子数据
insert into public.plans (id, title, description, grant_amount, price_cents, currency, recurring, stripe_price_id, active)
values
  ('one-off-50', '一次性 50 次', '购买后立即增加 50 次额度', 50, 499, 'usd', false, null, true),
  ('monthly-100', '每月 100 次订阅', '每月自动增加 100 次', 100, 999, 'usd', true, null, true)
on conflict (id) do nothing;

-- 备注：服务端使用 Service Role Key 绕过 RLS 执行写入
-- 所有额度修改与付款入账均通过 Edge Functions 完成
