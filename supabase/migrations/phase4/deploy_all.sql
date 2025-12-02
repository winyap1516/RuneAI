-- Phase 4 完整部署脚本 (Schema + RPC + RLS)
-- 请在 Supabase Dashboard 的 SQL Editor 中运行此脚本

-- ==========================================
-- 1. 数据库 Schema 与 RLS
-- ==========================================

-- users（示例表，通常由 Supabase Auth 管理用户）
create table if not exists public.users (
  id uuid primary key,
  email text unique,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- websites（对应本地 links）
create table if not exists public.websites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  url text not null,
  title text,
  description text,
  category text,
  tags jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists websites_user_idx on public.websites(user_id);
create index if not exists websites_url_user_idx on public.websites(url, user_id);

-- subscriptions
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  website_id uuid not null,
  frequency text check (frequency in ('daily','weekly') ),
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists subs_user_idx on public.subscriptions(user_id);
create index if not exists subs_website_user_idx on public.subscriptions(website_id, user_id);

-- digests
create table if not exists public.digests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  type text check (type in ('manual','daily') ),
  generated_at timestamptz default now(),
  entries jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists digests_user_idx on public.digests(user_id);

-- generation_logs（审计）
create table if not exists public.generation_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  website_id uuid,
  status text check (status in ('success','failed') ),
  error jsonb,
  created_at timestamptz default now()
);
create index if not exists genlogs_user_idx on public.generation_logs(user_id);

-- client_changes（客户端变更日志，幂等依赖唯一约束）
create table if not exists public.client_changes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  client_change_id text not null unique,
  resource_type text not null,
  resource_id uuid,
  op text check (op in ('create','update','delete') ),
  payload jsonb,
  client_ts timestamptz not null default now(),
  synced_at timestamptz,
  base_server_ts timestamptz,
  conflict_version int
);
create index if not exists client_changes_user_ts_idx on public.client_changes(user_id, client_ts);

-- RLS 策略：仅允许本人读写（user_id = auth.uid()）
alter table public.websites enable row level security;
alter table public.subscriptions enable row level security;
alter table public.digests enable row level security;
alter table public.generation_logs enable row level security;
alter table public.client_changes enable row level security;

-- Dropping existing policies to avoid errors on re-run
drop policy if exists websites_select on public.websites;
drop policy if exists websites_modify on public.websites;
drop policy if exists subs_select on public.subscriptions;
drop policy if exists subs_modify on public.subscriptions;
drop policy if exists digests_select on public.digests;
drop policy if exists digests_modify on public.digests;
drop policy if exists genlogs_select on public.generation_logs;
drop policy if exists genlogs_insert on public.generation_logs;
drop policy if exists changes_select on public.client_changes;
drop policy if exists changes_modify on public.client_changes;

create policy websites_select on public.websites for select using (user_id = auth.uid());
create policy websites_modify on public.websites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy subs_select on public.subscriptions for select using (user_id = auth.uid());
create policy subs_modify on public.subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy digests_select on public.digests for select using (user_id = auth.uid());
create policy digests_modify on public.digests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy genlogs_select on public.generation_logs for select using (user_id = auth.uid());
create policy genlogs_insert on public.generation_logs for insert with check (user_id = auth.uid());

create policy changes_select on public.client_changes for select using (user_id = auth.uid());
create policy changes_modify on public.client_changes for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ==========================================
-- 2. RPC Function (apply_client_changes)
-- ==========================================

create or replace function public.apply_client_changes(
  p_user_id uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_applied jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  ch jsonb;
  v_cid text;
  v_op text;
  v_type text;
  v_resource_id text;
  v_payload jsonb;
  v_base_ts timestamptz;
  v_server_id uuid;
  v_current_ts timestamptz;
begin
  if p_changes is null or jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
  end if;

  for ch in select * from jsonb_array_elements(p_changes) loop
    v_cid := ch->>'client_change_id';
    v_op := ch->>'op';
    v_type := ch->>'resource_type';
    v_resource_id := ch->>'resource_id'; -- 注意：更新/删除时应为服务器 UUID；迁移 create 可为本地 ID
    v_payload := ch->'payload';
    v_base_ts := nullif(ch->>'base_server_ts','')::timestamptz;

    begin
      -- 幂等：写入 client_changes（若重复则抛出冲突，进入 EXCEPTION）
      insert into public.client_changes(
        user_id, client_change_id, resource_type, resource_id, op, payload, client_ts, base_server_ts
      ) values (
        p_user_id, v_cid, v_type, nullif(v_resource_id,'')::uuid, v_op, v_payload, now(), v_base_ts
      );

      if v_type = 'website' then
        if v_op = 'create' then
          insert into public.websites(user_id, url, title, description, category, tags)
          values (
            p_user_id,
            v_payload->>'url',
            v_payload->>'title',
            v_payload->>'description',
            v_payload->>'category',
            v_payload->'tags'
          ) returning id into v_server_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object(
            'client_change_id', v_cid,
            'local_id', v_resource_id,
            'server_id', v_server_id
          ));
        elsif v_op = 'update' then
          -- 基于 base_server_ts 与当前 updated_at 的冲突检测
          select updated_at into v_current_ts from public.websites where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
          if v_current_ts is null then
            raise exception 'RESOURCE_NOT_FOUND';
          end if;
          if v_base_ts is not null and v_base_ts >= v_current_ts then
            update public.websites
            set title = coalesce(v_payload->>'title', title),
                url = coalesce(v_payload->>'url', url),
                description = coalesce(v_payload->>'description', description),
                category = coalesce(v_payload->>'category', category),
                tags = coalesce(v_payload->'tags', tags),
                updated_at = now()
            where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
            v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id));
          else
            raise exception 'BASE_SERVER_TS_TOO_OLD';
          end if;
        elsif v_op = 'delete' then
          delete from public.websites where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id));
        end if;
      elsif v_type = 'subscription' then
        if v_op = 'create' then
          insert into public.subscriptions(user_id, website_id, frequency, enabled)
          values (p_user_id, nullif(v_payload->>'website_id','')::uuid, coalesce(v_payload->>'frequency','daily'), coalesce((v_payload->>'enabled')::boolean, true))
          returning id into v_server_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id, 'server_id', v_server_id));
        elsif v_op = 'update' then
          -- Subscription 更新 (frequency, enabled)
          update public.subscriptions
          set frequency = coalesce(v_payload->>'frequency', frequency),
              enabled = coalesce((v_payload->>'enabled')::boolean, enabled),
              updated_at = now()
          where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id));
        elsif v_op = 'delete' then
          delete from public.subscriptions where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id));
        end if;
      elsif v_type = 'digest' then
        if v_op = 'create' then
          insert into public.digests(user_id, type, entries)
          values (p_user_id, coalesce(v_payload->>'type','daily'), v_payload->'entries')
          returning id into v_server_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id, 'server_id', v_server_id));
        end if;
      end if;

    exception when unique_violation then
      -- client_change_id 重复：视为已应用（幂等），返回占位映射
      v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id));
    when others then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'conflict', true,
        'reason', coalesce(SQLERRM, 'UNKNOWN_ERROR'),
        'server_snapshot', '{}'::jsonb,
        'client_payload', v_payload,
        'client_change_id', v_cid
      ));
    end;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end;
$$;
