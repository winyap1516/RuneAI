-- 中文注释：Phase 5 - 字段级 LWW 自动合并 + Tombstone 删除 + 备份审计

-- 1) 主资源表增加字段（data, field_timestamps, server_applied_ts, deleted, deleted_at）
alter table public.websites
  add column if not exists data jsonb,
  add column if not exists field_timestamps jsonb,
  add column if not exists server_applied_ts timestamptz,
  add column if not exists deleted boolean default false,
  add column if not exists deleted_at timestamptz;

alter table public.subscriptions
  add column if not exists data jsonb,
  add column if not exists field_timestamps jsonb,
  add column if not exists server_applied_ts timestamptz,
  add column if not exists deleted boolean default false,
  add column if not exists deleted_at timestamptz;

alter table public.digests
  add column if not exists data jsonb,
  add column if not exists field_timestamps jsonb,
  add column if not exists server_applied_ts timestamptz,
  add column if not exists deleted boolean default false,
  add column if not exists deleted_at timestamptz;

-- 2) 客户端变更表增加字段级时间戳
alter table public.client_changes
  add column if not exists field_timestamps jsonb;

-- 3) 备份审计表
create table if not exists public.conflict_backups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  item_id uuid not null,
  client_change_id text,
  local_snapshot jsonb,
  server_snapshot jsonb,
  created_at timestamptz default now()
);
create index if not exists conflict_backups_user_idx on public.conflict_backups(user_id);
create index if not exists conflict_backups_item_idx on public.conflict_backups(item_id);

create table if not exists public.deletion_backups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  item_id uuid not null,
  snapshot jsonb,
  deleted_at timestamptz,
  retention_expires_at timestamptz default (now() + interval '30 days'),
  created_at timestamptz default now()
);
create index if not exists deletion_backups_user_idx on public.deletion_backups(user_id);
create index if not exists deletion_backups_item_idx on public.deletion_backups(item_id);

-- 4) 替换 RPC：字段级 LWW 合并 + Tombstone
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
  v_conflicts_logged int := 0;
  ch jsonb;
  v_cid text;
  v_type text;
  v_item uuid;
  v_op text;
  v_payload jsonb;
  v_fields jsonb;
  v_server jsonb;
  v_server_fields jsonb;
  v_merged jsonb;
  v_merged_fields jsonb;
  v_deleted boolean;
  v_deleted_at timestamptz;
begin
  if p_changes is null or jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('applied', v_applied, 'conflicts_logged', v_conflicts_logged);
  end if;

  for ch in select * from jsonb_array_elements(p_changes) loop
    v_cid := ch->>'client_change_id';
    v_type := ch->>'resource_type';
    v_item := nullif(ch->>'resource_id','')::uuid; -- 兼容老字段名
    v_op := ch->>'op';
    v_payload := coalesce(ch->'payload','{}'::jsonb);
    v_fields := coalesce(ch->'field_timestamps','{}'::jsonb);

    begin
      -- 幂等：记录 client_changes（唯一约束）
      insert into public.client_changes(user_id, client_change_id, resource_type, resource_id, op, payload, client_ts, field_timestamps)
      values (p_user_id, v_cid, v_type, v_item, v_op, v_payload, now(), v_fields);

      if v_type = 'website' then
        -- 读取当前服务器快照
        select jsonb_build_object('data', data, 'field_timestamps', field_timestamps, 'deleted', deleted) into v_server
        from public.websites where id = v_item and user_id = p_user_id for update;

        if v_op = 'create' and v_item is null then
          -- 创建：写入 data/field_timestamps，保留旧列（url/title...）以兼容现有代码
          insert into public.websites(user_id, url, title, description, category, tags, data, field_timestamps, server_applied_ts, deleted)
          values (
            p_user_id,
            v_payload->>'url',
            v_payload->>'title',
            v_payload->>'description',
            v_payload->>'category',
            v_payload->'tags',
            v_payload,
            v_fields,
            now(),
            false
          ) returning id into v_item;

          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'server_id', v_item, 'local_id', ch->>'resource_id'));

        elsif v_op in ('update','delete') and v_item is not null then
          v_server_fields := coalesce(v_server->'field_timestamps','{}'::jsonb);
          v_deleted := coalesce((v_payload->>'deleted')::boolean, false);
          v_deleted_at := case when v_deleted then (v_fields->>'deleted')::timestamptz else null end;

          -- 字段级 LWW 合并
          v_merged := coalesce(v_server->'data','{}'::jsonb);
          v_merged_fields := v_server_fields;

          -- 遍历 payload 的每个键，比较时间戳
          for select key, value from jsonb_each(v_payload) as e(key, value) loop
            declare k text; v_new_ts timestamptz; v_old_ts timestamptz; v_val jsonb; begin
              k := e.key; v_val := e.value; v_new_ts := (v_fields->>k)::timestamptz; v_old_ts := (v_server_fields->>k)::timestamptz;
              if v_old_ts is null or (v_new_ts is not null and v_new_ts > v_old_ts) then
                v_merged := v_merged || jsonb_build_object(k, v_val);
                v_merged_fields := v_merged_fields || jsonb_build_object(k, coalesce(v_new_ts, now()));
              else
                -- 服务器更新更新更晚：记录冲突备份
                insert into public.conflict_backups(user_id, item_id, client_change_id, local_snapshot, server_snapshot)
                values (p_user_id, v_item, v_cid, jsonb_build_object('data', v_payload, 'field_timestamps', v_fields), jsonb_build_object('data', v_server->'data', 'field_timestamps', v_server_fields));
                v_conflicts_logged := v_conflicts_logged + 1;
              end if;
            end;
          end loop;

          -- Tombstone 删除处理：删除需要赢过所有字段时间戳
          if v_deleted = true then
            -- 若服务器任何字段的 ts 新于 deleted_ts，则视为冲突，记录备份但不应用删除
            if exists (
              select 1 from jsonb_each(v_server_fields) s(k, v)
              where (v)::text::timestamptz > v_deleted_at
            ) then
              insert into public.conflict_backups(user_id, item_id, client_change_id, local_snapshot, server_snapshot)
              values (p_user_id, v_item, v_cid, jsonb_build_object('data', v_payload, 'field_timestamps', v_fields), jsonb_build_object('data', v_server->'data', 'field_timestamps', v_server_fields));
              v_conflicts_logged := v_conflicts_logged + 1;
            else
              update public.websites
                set deleted = true,
                    deleted_at = now(),
                    data = v_merged,
                    field_timestamps = v_merged_fields,
                    server_applied_ts = now()
              where id = v_item and user_id = p_user_id;

              insert into public.deletion_backups(user_id, item_id, snapshot, deleted_at)
              values (p_user_id, v_item, jsonb_build_object('data', v_merged, 'field_timestamps', v_merged_fields), now());
            end if;
          else
            update public.websites
              set data = v_merged,
                  field_timestamps = v_merged_fields,
                  server_applied_ts = now(),
                  -- 兼容旧列更新
                  title = coalesce(v_merged->>'title', title),
                  url = coalesce(v_merged->>'url', url),
                  description = coalesce(v_merged->>'description', description),
                  category = coalesce(v_merged->>'category', category),
                  tags = coalesce(v_merged->'tags', tags)
            where id = v_item and user_id = p_user_id;
          end if;

          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'item_id', v_item, 'merged_record', jsonb_build_object('resource_type', v_type, 'item_id', v_item, 'data', v_merged, 'deleted', coalesce(v_deleted,false))));
        end if;

      end if;

    exception when unique_violation then
      -- 幂等：重复的 client_change 视为已应用
      v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'item_id', v_item));
    when others then
      -- 错误不阻断：记录为冲突备份
      insert into public.conflict_backups(user_id, item_id, client_change_id, local_snapshot, server_snapshot)
      values (p_user_id, coalesce(v_item, gen_random_uuid()), v_cid, v_payload, v_server);
      v_conflicts_logged := v_conflicts_logged + 1;
    end;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts_logged', v_conflicts_logged);
end;
$$;

-- 5) Purge 任务（占位，实际由 Cron/Edge Function 调用）
-- 示例：select * from public.deletion_backups where retention_expires_at < now();
