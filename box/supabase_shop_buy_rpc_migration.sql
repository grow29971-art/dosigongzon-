-- 도시공존 — 상점 구매를 원자적으로 처리 (경쟁 상태 방지)
-- 기존 /api/shop/buy는 "코인 조회 → 가격 비교 → 코인 차감 + 아이템 지급"을
-- 별도 쿼리로 나눠서 처리했음. 동시에 같은 아이템을 여러 번 빠르게 구매
-- 요청하면(더블탭, 자동화 스크립트 등) 둘 다 같은 coins 값을 읽고 통과해서
-- 실제 잔액보다 많은 아이템을 살 수 있는 경쟁 상태가 있었음.
-- FOR UPDATE로 프로필 행을 잠그고 트랜잭션 안에서 검증·차감·지급을 전부
-- 처리해서 막는다.

create or replace function public.buy_shop_item_atomic(
  p_user_id uuid,
  p_item_key text,
  p_price int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coins int;
  v_existing_qty int;
  v_new_coins int;
  v_new_qty int;
begin
  select coins into v_coins from public.profiles where id = p_user_id for update;
  if v_coins is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if v_coins < p_price then
    return jsonb_build_object('error', 'insufficient_coins', 'need', p_price, 'have', v_coins);
  end if;

  select quantity into v_existing_qty from public.user_items
    where user_id = p_user_id and item_key = p_item_key;

  v_new_coins := v_coins - p_price;
  v_new_qty := coalesce(v_existing_qty, 0) + 1;

  update public.profiles set coins = v_new_coins where id = p_user_id;

  insert into public.user_items (user_id, item_key, quantity, updated_at)
    values (p_user_id, p_item_key, v_new_qty, now())
    on conflict (user_id, item_key)
    do update set quantity = v_new_qty, updated_at = now();

  return jsonb_build_object('ok', true, 'coins', v_new_coins, 'item_key', p_item_key, 'quantity', v_new_qty);
end;
$$;

grant execute on function public.buy_shop_item_atomic(uuid, text, int) to authenticated;
