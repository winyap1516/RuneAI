-- 中文注释：RLS 精准策略修复（Phase 8 - RLS Fix）
-- 目标：移除普通用户对 user_quotas 的更新权限，确保仅管理员可写

-- 删除用户自更新策略（谨慎：此前为了演示而开放，现关闭）
drop policy if exists user_quota_user_update_self on public.user_quotas;

-- 重新声明管理员策略（幂等保护）：管理员可读写所有记录
create policy if not exists user_quota_admin_all on public.user_quotas
  for all
  using (current_setting('jwt.claims.role', true) = 'admin')
  with check (current_setting('jwt.claims.role', true) = 'admin');

-- 说明：普通用户仅保留查询自身额度的权限（不做写入）
-- 若数据库中不存在该策略，则创建；若已存在则保持不变
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_quotas' and policyname = 'user_quota_select_own'
  ) then
    create policy user_quota_select_own on public.user_quotas
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
