-- ══════════════════════════════════════════
-- 게스트(비로그인) 구매 인프라 (2026-07-18)
-- 목적: 로그인 없이도 주문 생성·조회·취소. 결제 오픈(통신판매업 신고) 시 즉시 동작.
-- 보안 원칙: anon에게 orders INSERT RLS를 열지 않는다(위조 위험). 대신 아래 SECURITY DEFINER
--   RPC로 서버가 금액·재고를 재계산해 pending 주문을 만든다(기존 감사 철학과 동일).
--   게스트는 order_number + guest_token(비밀)으로만 자기 주문 조회/취소 가능.
-- ⚠ 결제 하드락(lib/payments-config.ts PAYMENT_ENABLED)은 별개 — 클라이언트가 결제 전 차단.
--    이 RPC는 pending 주문만 만들며 돈·재고를 움직이지 않음(재고 차감은 결제 승인 API).
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_migration.sql, supabase_shop_orders_insert_guard_migration.sql,
--       supabase_shop_virtual_order_migration.sql(recipient NOT NULL 해제)
-- ══════════════════════════════════════════

-- 1) 스키마 — user_id nullable + guest 식별 컬럼
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists guest_token uuid;
alter table public.orders add column if not exists guest_email text; -- 주문확인용(현재 예약, 미사용 가능)

create index if not exists orders_guest_token_idx
  on public.orders (guest_token) where guest_token is not null;

-- 회원 주문이거나 게스트 주문이거나(둘 중 하나는 반드시)
alter table public.orders drop constraint if exists orders_owner_check;
alter table public.orders add constraint orders_owner_check
  check (user_id is not null or guest_token is not null);

-- 2) 게스트 주문 생성 RPC — 서버가 상품·재고·금액 재계산(클라 금액 불신)
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

-- 3) 게스트 주문 조회 RPC — order_number + token 일치해야만 반환
create or replace function public.get_guest_order(p_order_number text, p_guest_token uuid)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((select jsonb_agg(to_jsonb(oi) order by oi.created_at) from order_items oi where oi.order_id = o.id), '[]'::jsonb)
  )
  from orders o
  where o.order_number = p_order_number and o.guest_token = p_guest_token
  limit 1;
$$;
revoke execute on function public.get_guest_order(text, uuid) from public;
grant execute on function public.get_guest_order(text, uuid) to anon, authenticated;

-- 4) 게스트 주문 취소 RPC — pending(결제 전)만. 결제완료 취소는 환불이 필요해 CS/결제취소 API 경로.
create or replace function public.cancel_guest_order(p_order_number text, p_guest_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_updated int;
begin
  update orders set status = 'cancelled', updated_at = now()
   where order_number = p_order_number and guest_token = p_guest_token and status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end $$;
revoke execute on function public.cancel_guest_order(text, uuid) from public;
grant execute on function public.cancel_guest_order(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증:
--   select public.create_guest_order('[{"product_id":"<실제상품id>","quantity":1}]'::jsonb,
--     '{"recipient_name":"테스트","recipient_phone":"01000000000","recipient_address":"서울"}'::jsonb);
--   → order_number/guest_token 반환되면 성공. 이후 get_guest_order로 조회, cancel_guest_order로 취소 확인 후 테스트 주문 삭제.

-- ── 롤백 ──
-- drop function if exists public.cancel_guest_order(text, uuid);
-- drop function if exists public.get_guest_order(text, uuid);
-- drop function if exists public.create_guest_order(jsonb, jsonb);
-- alter table public.orders drop constraint if exists orders_owner_check;
-- drop index if exists public.orders_guest_token_idx;
-- alter table public.orders drop column if exists guest_email;
-- alter table public.orders drop column if exists guest_token;
-- -- user_id NOT NULL 복원은 게스트 주문 존재 시 실패하므로, 게스트 주문 정리 후:
-- -- alter table public.orders alter column user_id set not null;
-- notify pgrst, 'reload schema';
