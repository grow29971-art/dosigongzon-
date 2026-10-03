-- ══════════════════════════════════════════
-- 주문·주문품목 서버 전용 컬럼 초기화 (10/3 쇼핑 악용 감사 1·3번)
-- 증상: 회원 주문은 브라우저가 orders·order_items를 직접 INSERT한다(lib/order-repo.ts). INSERT 정책은
--   status·payment_key·paid_at·tracking_number만 막아서, 서버만 써야 할 컬럼을 미리 채울 수 있었다.
--   ① orders.delivered_at='2099-01-01' 선주입 → 관리자 배송완료가 기존 값을 보존(lib/shop-admin-repo.ts) →
--      반품 기한 계산이 음수라 7일/90일 기한 무력화.
--   ② order_items.refunded_quantity=quantity 선주입 → 즉시환불 시 재고 복원량 0 → 해당 상품 영구 품절.
--      donation_refunded 선주입 → 공개 후원 집계 차감.
-- 처방: PostgREST 직접 쓰기(current_user = authenticated/anon)일 때만 서버 전용 컬럼을 기본값으로 덮는다.
--   서버(service_role)·definer RPC(create_guest_order 등)는 current_user가 달라 통과 — 기존 경로 무변화.
--   (DEFINER×current_user 함정: engineering-notes 10/2 — invoker 함수라 current_user가 호출 역할 그대로다.)
-- 결제 게이트가 꺼져 있어 현재 실피해 0. 결제 오픈 전 필수.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF — 2026-10-03 실행·검증(롤백 전용 실측: delivered_at 2099→NULL, refund_amount 999→0, refunded_quantity 1→0)
-- ══════════════════════════════════════════

create or replace function public.orders_reset_server_columns()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- 없는 컬럼 키는 jsonb_populate_record가 무시한다 — 라이브에 컬럼 하나가 빠져 있어도 주문 INSERT가 깨지지 않게.
  new := jsonb_populate_record(new, jsonb_build_object(
    'shipped_at', null, 'delivered_at', null,
    'refund_status', 'none', 'refund_amount', 0, 'refund_requested_at', null, 'refunded_at', null, 'refund_reason', null,
    'courier', null, 'payment_method', null, 'user_deleted_at', null,
    'created_at', now(), 'updated_at', now()));
  return new;
end $$;

drop trigger if exists orders_reset_server_columns on public.orders;
create trigger orders_reset_server_columns
  before insert on public.orders
  for each row execute function public.orders_reset_server_columns();

create or replace function public.order_items_reset_server_columns()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new := jsonb_populate_record(new, jsonb_build_object('refunded_quantity', 0, 'donation_refunded', 0));
  return new;
end $$;

drop trigger if exists order_items_reset_server_columns on public.order_items;
create trigger order_items_reset_server_columns
  before insert on public.order_items
  for each row execute function public.order_items_reset_server_columns();

revoke all on function public.orders_reset_server_columns() from public, anon, authenticated;
revoke all on function public.order_items_reset_server_columns() from public, anon, authenticated;

-- ── 검증 ──
-- select tgname from pg_trigger where tgname in ('orders_reset_server_columns','order_items_reset_server_columns'); → 2행
-- 롤백 전용 실측(데이터 안 남음):
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.admins limit 1), 'role','authenticated')::text, true);
--   insert into public.orders (user_id, order_number, status, total_amount, shipping_fee, payment_amount,
--          recipient_name, recipient_phone, recipient_address, postal_code, delivered_at, refund_amount)
--   values ((select user_id from public.admins limit 1), 'DS-PROBE-0000', 'pending', 1000, 0, 1000, 'x', '010', 'x', '00000', '2099-01-01', 999)
--   returning delivered_at, refund_amount;   → null, 0
-- rollback;
-- ── 롤백 ──
-- drop trigger if exists orders_reset_server_columns on public.orders;
-- drop trigger if exists order_items_reset_server_columns on public.order_items;
-- drop function if exists public.orders_reset_server_columns();
-- drop function if exists public.order_items_reset_server_columns();
