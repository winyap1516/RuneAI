-- 中文注释：为 links 表添加 AI 状态字段（前端用于同步卡片处理状态）
-- 说明：RLS 已在 001_schema.sql 中配置；此处仅增加非鉴权字段

do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'links' and column_name = 'ai_status'
  ) then
    alter table public.links add column ai_status text;
  end if;
end $$;

-- 可选：为常见状态添加检查约束（如需严格控制）
-- 注意：若担心历史数据兼容性，可暂不添加 check 约束，仅由前端写入约束控制
-- alter table public.links add constraint links_ai_status_check 
--   check (ai_status is null or ai_status in ('pending','completed','failed'));

