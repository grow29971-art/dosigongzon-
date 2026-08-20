-- ══════════════════════════════════════════
-- 배송비 품목당 합산 — create_guest_order RPC 갱신 (2026-08-20, D-day 게이트 3)
-- 기존: greatest(최대 배송비 1건만) → 20kg 사료 3개 주문 시 배송비 1건만 부과돼 택배비 전액 손실.
-- 변경: 배송비 = Σ(shipping_fee × 수량). 코드 측(computeCartTotal·payment/confirm·payment/webhook)과
--   반드시 동일 식 — 한쪽만 다르면 금액 검증(integrity)이 어긋나 결제 승인이 전부 거부된다.
--   코드 측은 커밋으로 배포됨. 이 SQL은 게스트 주문 경로의 서버 계산을 맞추는 것.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_guest_order_migration.sql (원본 함수)
-- ══════════════════════════════════════════

create or replace function public.create_guest_order(p_items jsonb, p_shipping jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb; v_pid uuid; v_qty int; v_prod record;
  v_unit int; v_subtotal int; v_donation int;
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
    -- ★ 변경 지점: greatest(...) → 품목당 합산 (게이트 3)
    v_shipping_fee := v_shipping_fee + coalesce(v_prod.shipping_fee, 0) * v_qty;
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
    v_donation := case when v_prod.is_donation
      then floor(v_subtotal * v_prod.donation_percent / 100.0)::int else 0 end;
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
-- 롤백 (되돌릴 때만): supabase_shop_guest_order_migration.sql의
-- create_guest_order 정의(greatest 방식)를 다시 실행하면 원상복구.
-- ══════════════════════════════════════════
-- 끝.
