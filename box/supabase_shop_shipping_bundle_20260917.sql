-- ══════════════════════════════════════════
-- 배송비 주문당 1회(합포장) — create_guest_order RPC 갱신 (2026-09-17)
-- 기존: Σ(shipping_fee × 수량) (2026-08-20 게이트 3, supabase_shop_shipping_sum_migration.sql).
-- 변경: 배송비 = greatest(shipping_fee) — 여러 상품·수량을 합포장으로 보내므로 주문당 1건만 부과
--   (사장님 결정 2026-09-17). 후원액 공식 등 나머지는 supabase_shop_profit_donation_migration.sql
--   버전과 동일하며 배송비 한 줄만 바뀐다.
-- ⚠ 코드 측(computeCartTotal·payment/confirm·payment/webhook)과 반드시 같은 식 —
--   한쪽만 다르면 금액 검증(integrity)이 어긋나 결제 승인이 전부 거부된다. 코드 측은 커밋으로 배포됨.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_profit_donation_migration.sql (현재 함수 정의)
-- ══════════════════════════════════════════

create or replace function public.create_guest_order(p_items jsonb, p_shipping jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_pid uuid; v_qty int; v_prod record;
  v_unit int; v_cost int; v_subtotal int; v_donation int;
  v_product_total int := 0; v_shipping_fee int := 0; v_all_virtual boolean := true;
  v_order_id uuid; v_order_no text; v_token uuid := gen_random_uuid();
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v_suffix text; v_try int; i int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '주문할 상품이 없어요.';
  end if;

  -- (a) 검증 + 서버 권위 합계
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 then raise exception '수량이 올바르지 않아요.'; end if;
    select id, name, price, sale_price, stock, is_active, shipping_fee,
           is_donation, donation_percent, is_virtual
      into v_prod from products where id = v_pid;
    if not found or not v_prod.is_active then raise exception '판매 종료된 상품이 있어요.'; end if;
    if v_prod.stock < v_qty then raise exception '재고가 부족한 상품이 있어요.'; end if;
    v_unit := coalesce(v_prod.sale_price, v_prod.price);
    v_product_total := v_product_total + v_unit * v_qty;
    -- ★ 변경 지점: 품목당 합산 → 주문당 1회(합포장, 최대값)
    v_shipping_fee := greatest(v_shipping_fee, coalesce(v_prod.shipping_fee, 0));
    if not v_prod.is_virtual then v_all_virtual := false; end if;
  end loop;

  -- (b) 실물 포함 시 배송지 필수
  if not v_all_virtual then
    if p_shipping is null
       or coalesce(p_shipping->>'recipient_name','') = ''
       or coalesce(p_shipping->>'recipient_phone','') = ''
       or coalesce(p_shipping->>'recipient_address','') = '' then
      raise exception '배송지 정보가 필요해요.';
    end if;
  end if;
  if v_all_virtual then v_shipping_fee := 0; end if;

  -- (c) 주문 생성(주문번호 충돌 시 재시도)
  for v_try in 1..5 loop
    v_suffix := '';
    for i in 1..4 loop
      v_suffix := v_suffix || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    end loop;
    v_order_no := 'DS-' || to_char((now() at time zone 'Asia/Seoul'), 'YYYYMMDD') || '-' || v_suffix;
    begin
      insert into orders(
        user_id, guest_token, order_number, status,
        total_amount, shipping_fee, payment_amount,
        recipient_name, recipient_phone, recipient_address, recipient_address_detail, postal_code, memo
      ) values (
        null, v_token, v_order_no, 'pending',
        v_product_total, v_shipping_fee, v_product_total + v_shipping_fee,
        nullif(p_shipping->>'recipient_name',''), nullif(p_shipping->>'recipient_phone',''),
        nullif(p_shipping->>'recipient_address',''), nullif(p_shipping->>'recipient_address_detail',''),
        nullif(p_shipping->>'postal_code',''), nullif(p_shipping->>'memo','')
      ) returning id into v_order_id;
      exit;
    exception when unique_violation then
      if v_try = 5 then raise; end if;
    end;
  end loop;

  -- (d) order_items 스냅샷(서버 계산 — 가드 트리거가 재검증)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    select name, price, sale_price, is_donation, donation_percent
      into v_prod from products where id = v_pid;
    v_unit := coalesce(v_prod.sale_price, v_prod.price);
    v_subtotal := v_unit * v_qty;
    select coalesce(cost_price, 0) into v_cost
      from product_costs where product_id = v_pid;
    v_cost := coalesce(v_cost, 0);
    -- ★ 변경 지점: 이익 기준 후원액 — 트리거·confirm·webhook과 동일 식 (상단 공식 주석)
    v_donation := case
      when not v_prod.is_donation then 0
      when v_prod.donation_percent >= 100 then v_subtotal
      else floor(greatest(v_unit - v_cost, 0) * v_qty * v_prod.donation_percent / 100.0)::int
    end;
    insert into order_items(order_id, product_id, product_name, product_price, quantity, subtotal, donation_amount)
      values (v_order_id, v_pid, v_prod.name, v_unit, v_qty, v_subtotal, v_donation);
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_no,
    'guest_token', v_token, 'payment_amount', v_product_total + v_shipping_fee
  );
end $$;
revoke execute on function public.create_guest_order(jsonb, jsonb) from public;
grant execute on function public.create_guest_order(jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증 (실행 후, anon 키로):
--   select public.create_guest_order('[{"product_id":"<대즐 id>","quantity":2}]'::jsonb,
--     '{"recipient_name":"테스트","recipient_phone":"010-0000-0000","recipient_address":"테스트"}'::jsonb);
--   → payment_amount = 70000×2 + 5000 = 145000 (합산이면 150000). 확인 후 해당 pending 주문은 삭제.
--
-- 롤백 (되돌릴 때만): supabase_shop_profit_donation_migration.sql의 4절(create_guest_order,
-- 품목당 합산 버전)을 다시 실행하면 원상복구. 코드 측 3곳도 함께 되돌려야 한다.
-- ══════════════════════════════════════════
-- 끝.
