-- 修复 sync-push RPC 函数：统一 resource_id 为 text，支持 links.ai_status/source/generation_meta，并返回 authoritative merged_record
-- 确保 source 字段存在
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'links' AND column_name = 'source') THEN
        ALTER TABLE links ADD COLUMN source TEXT DEFAULT 'Manual';
    END IF;
END $$;

create or replace function public.apply_client_changes(
  p_user_id uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
as $func$
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
  -- 批次内 ID 映射 (local_id -> server_uuid)
  v_id_map jsonb := '{}'::jsonb;
  v_target_id uuid;
begin
  if p_changes is null or jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
  end if;

  for ch in select * from jsonb_array_elements(p_changes) loop
    v_cid := ch->>'client_change_id';
    v_op := ch->>'op';
    v_type := ch->>'resource_type';
    v_resource_id := ch->>'resource_id';
    v_payload := ch->'payload';
    v_base_ts := nullif(ch->>'base_server_ts','')::timestamptz;

    begin
      -- 幂等检查：插入 client_changes (resource_id 为 text)
      insert into public.client_changes(
        user_id, client_change_id, resource_type, resource_id, op, payload, client_ts, base_server_ts
      ) values (
        p_user_id, v_cid, v_type, v_resource_id, v_op, v_payload, now(), v_base_ts
      );

      -- 解析目标 UUID（非 create）
      v_target_id := null;
      if v_op <> 'create' then
        if v_id_map ? v_resource_id then
           v_target_id := (v_id_map->>v_resource_id)::uuid;
        else
           begin
             v_target_id := nullif(v_resource_id,'')::uuid;
           exception when others then
             v_target_id := null;
           end;
        end if;
      end if;

      if v_type = 'link' or v_type = 'website' then
        if v_op = 'create' then
          insert into public.links(user_id, url, title, description, category, tags, ai_status, source, generation_meta)
          values (
            p_user_id,
            v_payload->>'url',
            v_payload->>'title',
            v_payload->>'description',
            v_payload->>'category',
            v_payload->'tags',
            coalesce(v_payload->>'ai_status', 'pending'),
            coalesce(v_payload->>'source', 'Manual'),
            coalesce(v_payload->'generation_meta', null)
          ) returning id into v_server_id;
          
          -- 记录映射
          v_id_map := jsonb_set(v_id_map, array[v_resource_id], to_jsonb(v_server_id));

          v_applied := v_applied || jsonb_build_array(
            jsonb_build_object(
              'client_change_id', v_cid,
              'local_id', v_resource_id,
              'server_id', v_server_id,
              'merged_record', jsonb_build_object(
                'resource_type', 'website',
                'item_id', v_server_id,
                'deleted', false,
                'data', (
                  select to_jsonb(l) - 'id' - 'user_id'
                  from public.links l
                  where l.id = v_server_id and l.user_id = p_user_id
                )
              )
            )
          );
        elsif v_op = 'update' then
          if v_target_id is null then
            raise exception 'INVALID_UUID_FOR_UPDATE';
          end if;
          select updated_at into v_current_ts from public.links where id = v_target_id and user_id = p_user_id;
          if v_current_ts is null then
            raise exception 'RESOURCE_NOT_FOUND';
          end if;
          if v_base_ts is not null and v_base_ts < v_current_ts then
             raise exception 'BASE_SERVER_TS_TOO_OLD';
          end if;

          update public.links
          set title = coalesce(v_payload->>'title', title),
              url = coalesce(v_payload->>'url', url),
              description = coalesce(v_payload->>'description', description),
              category = coalesce(v_payload->>'category', category),
              tags = coalesce(v_payload->'tags', tags),
              ai_status = coalesce(v_payload->>'ai_status', ai_status),
              source = coalesce(v_payload->>'source', source),
              generation_meta = coalesce(v_payload->'generation_meta', generation_meta),
              updated_at = now()
          where id = v_target_id and user_id = p_user_id;
          
          v_applied := v_applied || jsonb_build_array(
            jsonb_build_object(
              'client_change_id', v_cid,
              'local_id', v_resource_id,
              'merged_record', jsonb_build_object(
                'resource_type', 'website',
                'item_id', v_target_id,
                'deleted', false,
                'data', (
                  select to_jsonb(l) - 'id' - 'user_id'
                  from public.links l
                  where l.id = v_target_id and l.user_id = p_user_id
                )
              )
            )
          );
        elsif v_op = 'delete' then
          if v_target_id is not null then
            delete from public.links where id = v_target_id and user_id = p_user_id;
          end if;
          v_applied := v_applied || jsonb_build_array(
            jsonb_build_object(
              'client_change_id', v_cid,
              'local_id', v_resource_id,
              'merged_record', jsonb_build_object(
                'resource_type', 'website',
                'item_id', v_target_id,
                'deleted', true
              )
            )
          );
        end if;
      
      elsif v_type = 'subscription' then
        if v_op = 'create' then
          insert into public.subscriptions(user_id, website_id, frequency, enabled)
          values (p_user_id, nullif(v_payload->>'website_id','')::uuid, coalesce(v_payload->>'frequency','daily'), coalesce((v_payload->>'enabled')::boolean, true))
          returning id into v_server_id;
          v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid, 'local_id', v_resource_id, 'server_id', v_server_id));
        elsif v_op = 'update' then
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

    exception 
      when unique_violation then
        v_applied := v_applied || jsonb_build_array(jsonb_build_object('client_change_id', v_cid));
      when others then
         v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
           'client_change_id', v_cid,
           'conflict', true,
           'error', SQLERRM,
           'payload', v_payload
         ));
    end;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end;
$func$;
