-- 中文注释：审计与字段扩展（Phase 8 - Audit & Extend）

-- purchases 扩展：记录事件与会话标识，便于追踪与回滚
alter table public.purchases
  add column if not exists stripe_event_id text,
  add column if not exists stripe_session_id text;

-- 管理员审计日志表：记录额度修改操作
create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  admin_user_id uuid not null,
  target_user_id uuid not null,
  action text not null, -- set_quota
  payload jsonb,        -- 包含 daily_limit/extra_credits 变更
  created_at timestamptz not null default now()
);

-- RPC：幂等记录 Stripe 事件（ON CONFLICT DO NOTHING），返回是否新插入
create or replace function public.log_stripe_event(
  p_event_id text,
  p_type text,
  p_payload jsonb
) returns boolean language plpgsql as $$
declare
  v_inserted boolean := false;
begin
  insert into public.stripe_events(event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted; -- true 表示新插入；false 表示已存在（幂等）
end;
$$;

