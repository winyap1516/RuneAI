-- 中文注释：RPC 实现批量应用客户端变更，使用隐式子事务（EXCEPTION）达成 SAVEPOINT 效果
-- 说明：PostgREST 对单次 RPC 调用会在事务中执行；plpgsql 的 EXCEPTION 块相当于 SAVEPOINT/ROLLBACK TO

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

      if v_type = 'link' or v_type = 'website' then
        if v_op = 'create' then
          insert into public.links(user_id, url, title, description, category, tags)
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
          select updated_at into v_current_ts from public.links where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
          if v_current_ts is null then
            raise exception 'RESOURCE_NOT_FOUND';
          end if;
          if v_base_ts is not null and v_base_ts >= v_current_ts then
            update public.links
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
          delete from public.links where id = nullif(v_resource_id,'')::uuid and user_id = p_user_id;
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
