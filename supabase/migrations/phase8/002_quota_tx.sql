-- 中文注释：事务函数与并发安全（Phase 8 - TX）
-- 目标：提供事务性发放额度与生成摘要限流的服务端函数，避免并发竞态

create or replace function public.apply_purchase_and_grant(
  p_user_id uuid,
  p_plan_id text,
  p_amount int,
  p_currency text,
  p_payment_intent text
) returns void language plpgsql as $$
declare
  v_grant int;
  v_exists int;
  v_daily int;
  v_extra int;
  v_default int;
begin
  -- 中文：读取计划授予次数
  select grant_amount into v_grant from public.plans where id = p_plan_id;
  if v_grant is null then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  -- 中文：幂等：若已存在成功的同支付意图则跳过
  select count(*) into v_exists from public.purchases where stripe_payment_intent = p_payment_intent and status = 'succeeded';
  if v_exists > 0 then
    return;
  end if;

  -- 中文：写入 purchases（succeeded）
  insert into public.purchases(user_id, plan_id, amount, currency, status, stripe_payment_intent)
  values (p_user_id, p_plan_id, p_amount, p_currency, 'succeeded', p_payment_intent);

  -- 中文：读取默认每日额度
  select default_daily_limit into v_default from public.app_settings where id = 'global';
  if v_default is null then v_default := 5; end if;

  -- 中文：读取现有配额并更新额外额度，若不存在则创建
  select daily_limit, extra_credits into v_daily, v_extra from public.user_quotas where user_id = p_user_id;
  if v_daily is null then v_daily := v_default; end if;
  if v_extra is null then v_extra := 0; end if;

  insert into public.user_quotas(user_id, daily_limit, extra_credits, updated_at)
  values (p_user_id, v_daily, v_extra + v_grant, now())
  on conflict (user_id) do update set
    extra_credits = public.user_quotas.extra_credits + excluded.extra_credits,
    updated_at = now();
end;
$$;

create or replace function public.apply_refund_flag(
  p_payment_intent text,
  p_refund_id text
) returns void language plpgsql as $$
declare
  v_pid uuid;
begin
  -- 中文：标记退款，默认不自动扣减额度，留待人工处理
  update public.purchases
  set status = 'refunded', refund_status = 'flagged', stripe_refund_id = p_refund_id
  where stripe_payment_intent = p_payment_intent;
end;
$$;

create or replace function public.generate_digest_with_quota(
  p_user_id uuid,
  p_mode text,
  p_title text,
  p_summary text
) returns json language plpgsql as $$
declare
  v_daily int;
  v_extra int;
  v_default int;
  v_used int;
  v_now timestamptz := now();
  v_start timestamptz;
  v_end timestamptz;
  v_digest_id uuid;
begin
  v_start := date_trunc('day', v_now);
  v_end := v_start + interval '1 day' - interval '1 ms';

  -- 中文：锁定用户额度行（若不存在则锁定全局设置行）以序列化并发
  perform 1 from public.user_quotas where user_id = p_user_id for update;
  if not found then
    perform 1 from public.app_settings where id = 'global' for update;
  end if;

  -- 读取额度与默认
  select default_daily_limit into v_default from public.app_settings where id = 'global';
  if v_default is null then v_default := 5; end if;

  select daily_limit, extra_credits into v_daily, v_extra from public.user_quotas where user_id = p_user_id;
  if v_daily is null then v_daily := v_default; end if;
  if v_extra is null then v_extra := 0; end if;

  -- 计算今日使用
  select count(*) into v_used from public.digests
  where user_id = p_user_id and created_at >= v_start and created_at <= v_end;

  if (v_daily + v_extra - v_used) <= 0 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  -- 插入摘要
  insert into public.digests(user_id, title, summary, status, type)
  values (p_user_id, p_title, p_summary, 'pending', p_mode)
  returning id into v_digest_id;

  -- 若已达每日限额，则消耗一次性额外额度
  if v_used >= v_daily and v_extra > 0 then
    update public.user_quotas set extra_credits = greatest(0, extra_credits - 1), updated_at = now()
    where user_id = p_user_id;
  end if;

  return json_build_object('id', v_digest_id);
end;
$$;

