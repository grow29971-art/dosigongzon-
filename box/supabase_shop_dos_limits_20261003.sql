-- ══════════════════════════════════════════
-- 쇼핑 DB 팽창 차단 — 주문당 품목·수량 상한, 회원 주문 시간당 상한 (10/3 "터트리기" 감사 H-1·H-2)
-- 증상: ① create_guest_order(anon 실행 가능)가 p_items 개수 상한이 없어, 판매중 상품 1개를 수천 번 넣은 주문을
--         분당 20건씩 만들 수 있었다 → order_items 하루 수백만 행(정리 크론은 cancelled로만 바꾸고 삭제 안 함).
--       ② 회원 주문 속도 제한은 브라우저 코드뿐(lib/order-repo.ts) — 세션 JWT로 REST에 orders·order_items를 대량 INSERT 가능.
--       결제 게이트(PAYMENT_ENABLED)는 클라이언트에만 있어 결제가 꺼진 지금도 열려 있는 경로.
-- 처방: order_items BEFORE INSERT에서 주문당 품목 20개·수량 99 상한(모든 경로 — 게스트 RPC도 이 트리거를 탄다),
--       orders BEFORE INSERT에서 회원 직접 쓰기(current_user=authenticated)만 시간당 30건 상한.
--       같은 문장 안의 앞선 행은 row-level BEFORE 트리거의 조회에 보이므로 배열 bulk insert도 같은 상한에 걸린다.
-- 실수요: 장바구니는 unique(user_id, product_id)라 품목 수 = 상품 종류 수(현재 판매 상품 2종), 주문 시간당 수 건 미만.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF — 2026-10-03 실행·검증(트리거 2개, 롤백 전용 실측에서 21번째 품목 차단)
-- ══════════════════════════════════════════

create or replace function public.order_items_limits()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.quantity > 99 then
    raise exception '한 상품은 99개까지 주문할 수 있어요.';
  end if;
  if (select count(*) from order_items where order_id = new.order_id) >= 20 then
    raise exception '한 주문에는 상품을 20종까지 담을 수 있어요.';
  end if;
  return new;
end $$;

drop trigger if exists order_items_limits on public.order_items;
create trigger order_items_limits
  before insert on public.order_items
  for each row execute function public.order_items_limits();

create or replace function public.orders_member_rate_limit()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user = 'authenticated' and new.user_id is not null
     and (select count(*) from orders where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception '주문이 너무 많아요. 잠시 후 다시 시도해주세요.';
  end if;
  return new;
end $$;

drop trigger if exists orders_member_rate_limit on public.orders;
create trigger orders_member_rate_limit
  before insert on public.orders
  for each row execute function public.orders_member_rate_limit();

revoke all on function public.order_items_limits() from public, anon, authenticated;
revoke all on function public.orders_member_rate_limit() from public, anon, authenticated;

-- ── 검증 ──
-- select tgname from pg_trigger where tgname in ('order_items_limits','orders_member_rate_limit'); → 2행
-- 롤백 전용 실측(데이터 안 남음): 판매중 상품 id로 21품목 게스트 주문 → '20종까지' 오류
-- begin;
--   select public.create_guest_order(
--     (select jsonb_agg(jsonb_build_object('product_id', (select id from products where is_active limit 1), 'quantity', 1)) from generate_series(1, 21)),
--     '테스트', '01000000000', '서울', null, '00000', null, null);   -- 인자 목록은 라이브 시그니처에 맞출 것
-- rollback;
-- ── 롤백 ──
-- drop trigger if exists order_items_limits on public.order_items;
-- drop trigger if exists orders_member_rate_limit on public.orders;
-- drop function if exists public.order_items_limits();
-- drop function if exists public.orders_member_rate_limit();
