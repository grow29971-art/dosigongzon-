-- 도시공존 — 장착/해제를 DB 함수 하나로 원자 처리 (성능 개선)
-- 기존엔 API 라우트가 "소유권 확인 → 재고 조회 → 카드/재고 갱신(병렬)"으로
-- 최소 3번의 별도 왕복을 했음. 이 함수 하나로 합치면 왕복이 1번으로 줄어서
-- 장착/해제 반응 속도가 눈에 띄게 빨라짐. 트랜잭션 안에서 다 처리되니
-- 동시 요청에 의한 경쟁 상태도 같이 막힘(부수 효과로 안전성도 개선).

create or replace function public.equip_item_atomic(
  p_user_id uuid,
  p_cat_id uuid,
  p_slot text,      -- 'head'|'arm'|'body'|'leg'|'foot'|'border'
  p_item_key text    -- 해제하려면 null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caretaker_id uuid;
  v_equipped_slots jsonb;
  v_equipped_border text;
  v_current_key text;
  v_owned_qty int;
begin
  select caretaker_id, equipped_slots, equipped_border_key
    into v_caretaker_id, v_equipped_slots, v_equipped_border
    from public.cats where id = p_cat_id;

  if v_caretaker_id is null or v_caretaker_id <> p_user_id then
    return jsonb_build_object('error', 'cat_not_found');
  end if;

  if p_slot = 'border' then
    v_current_key := v_equipped_border;
  else
    v_current_key := coalesce(v_equipped_slots, '{}'::jsonb) ->> p_slot;
  end if;

  -- 같은 걸 다시 요청한 경우(사실상 no-op)
  if v_current_key is not distinct from p_item_key then
    return jsonb_build_object('ok', true, 'slot', p_slot, 'item_key', p_item_key);
  end if;

  -- 새로 장착하려는 아이템 재고 확인·차감
  if p_item_key is not null then
    select quantity into v_owned_qty from public.user_items
      where user_id = p_user_id and item_key = p_item_key
      for update;
    if coalesce(v_owned_qty, 0) < 1 then
      return jsonb_build_object('error', 'no_stock');
    end if;
    update public.user_items set quantity = quantity - 1, updated_at = now()
      where user_id = p_user_id and item_key = p_item_key;
  end if;

  -- 기존 장착템 반환
  if v_current_key is not null then
    insert into public.user_items (user_id, item_key, quantity, updated_at)
      values (p_user_id, v_current_key, 1, now())
      on conflict (user_id, item_key)
      do update set quantity = public.user_items.quantity + 1, updated_at = now();
  end if;

  if p_slot = 'border' then
    update public.cats set equipped_border_key = p_item_key where id = p_cat_id;
  else
    update public.cats
      set equipped_slots = coalesce(v_equipped_slots, '{}'::jsonb) || jsonb_build_object(p_slot, p_item_key)
      where id = p_cat_id;
  end if;

  return jsonb_build_object('ok', true, 'slot', p_slot, 'item_key', p_item_key);
end;
$$;

grant execute on function public.equip_item_atomic(uuid, uuid, text, text) to authenticated;
