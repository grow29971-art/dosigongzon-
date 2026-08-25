-- ══════════════════════════════════════════
-- 후원 적립 공식: 판매액 기준 → 이익(판매가−매입가) 기준 (2026-08-25, D-day 게이트 9)
-- 대외 고지가 "수익(이익)의 10%"로 확정됨(ba7e14e) — 적립 공식을 고지와 1:1로 맞춘다.
--
-- 공식 (4곳 반드시 동일 — 한쪽만 다르면 confirm/webhook의 후원액 교정이 어긋난다):
--   unit  = coalesce(sale_price, price)
--   cost  = coalesce(product_costs.cost_price, 0)      ← 매입가 없으면 0 = 기존(판매액 기준)과 동일
--   후원액 = is_donation 아니면 0
--          donation_percent >= 100 이면 unit × 수량     ← 전액 후원 상품은 "결제 금액 전액" (고지 문구 계약)
--          그 외 floor(greatest(unit − cost, 0) × 수량 × donation_percent / 100)
--   적용 지점: ① 이 파일의 order_items 트리거 ② 이 파일의 create_guest_order RPC
--             ③ app/api/payment/confirm ④ app/api/payment/webhook (③④는 lib/donation-calc.ts 공유)
--
-- 매입가는 마진 정보라 클라이언트 노출 금지 → products 컬럼이 아닌 별도 테이블
-- (product_costs, RLS: 관리자만 R/W, anon·일반 유저 정책 없음. 트리거·RPC는
--  security definer라 읽을 수 있고, confirm/webhook은 service_role로 읽는다)
--
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_order_item_guard_migration.sql (원본 트리거),
--       supabase_shop_shipping_sum_migration.sql (원본 RPC)
-- ══════════════════════════════════════════

-- ── 1. 매입가 테이블 (관리자 전용) ──
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_price integer not null default 0 check (cost_price >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_costs enable row level security;

drop policy if exists product_costs_admin_select on public.product_costs;
create policy product_costs_admin_select on public.product_costs
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists product_costs_admin_insert on public.product_costs;
create policy product_costs_admin_insert on public.product_costs
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists product_costs_admin_update on public.product_costs;
create policy product_costs_admin_update on public.product_costs
  for update using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists product_costs_admin_delete on public.product_costs;
create policy product_costs_admin_delete on public.product_costs
  for delete using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ── 2. 대즐 매입가 시드 (2026-08-19 구두합의 50,000원/15kg) ──
insert into public.product_costs (product_id, cost_price)
select id, 50000 from public.products where name like '%대즐%15kg%'
on conflict (product_id) do update set cost_price = excluded.cost_price, updated_at = now();

-- ── 3. order_items 스냅샷 트리거 — 이익 기준 후원액 ──
create or replace function public.enforce_order_item_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  unit integer;
  cost integer;
begin
  select name, price, sale_price, is_donation, donation_percent, is_active
    into p
  from public.products
  where id = new.product_id;

  if not found then
    raise exception '존재하지 않는 상품입니다';
  end if;

  -- 수량만 클라이언트 신뢰(결제 시 금액 재검증). 나머지는 서버 권위값으로 강제.
  if new.quantity is null or new.quantity <= 0 then
    raise exception '수량이 올바르지 않습니다';
  end if;

  unit := coalesce(p.sale_price, p.price);
  select coalesce(cost_price, 0) into cost
    from public.product_costs where product_id = new.product_id;
  cost := coalesce(cost, 0);

  new.product_name  := p.name;
  new.product_price := unit;
  new.subtotal      := unit * new.quantity;
  -- 후원액 = 이익(판매가−매입가) 기준. 전액 후원(100%)은 결제 금액 전액 — 상단 공식 주석 참조.
  new.donation_amount := case
    when not p.is_donation then 0
    when p.donation_percent >= 100 then unit * new.quantity
    else floor(greatest(unit - cost, 0) * new.quantity * p.donation_percent / 100.0)
  end;

  return new;
end;
$$;

-- ── 4. 게스트 주문 RPC — 후원액 부분만 이익 기준으로 (나머지는 shipping_sum 버전과 동일) ──
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
    v_shipping_fee := v_shipping_fee + coalesce(v_prod.shipping_fee, 0) * v_qty; -- 품목당 합산 (게이트 3)
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
-- 검증 (실행 후):
--   1) anon으로 GET /rest/v1/product_costs → 빈 배열([])이어야 함 (매입가 비노출)
--   2) select donation_amount from order_items 신규 주문 — 대즐 1개면
--      floor((70000−50000) × 1 × 10 / 100) = 2,000원이어야 함 (기존 7,000원)
-- 롤백 (되돌릴 때만):
--   트리거: supabase_shop_order_item_guard_migration.sql의 함수 정의(판매액 기준) 재실행
--   RPC:    supabase_shop_shipping_sum_migration.sql의 함수 정의 재실행
--   테이블: drop table public.product_costs;  (매입가 기록도 사라지므로 신중히)
-- ══════════════════════════════════════════
-- 끝.
