-- ══════════════════════════════════════════
-- 결제 악용 경로 DB 보강 (2026-10-02 결제 감사)
--
-- ① order_items 끼워넣기 경합 차단 — 결제 승인(confirm·웹훅)이 금액 검증 후 payment_key를 잡기 전
--    틈에 브라우저가 order_items를 INSERT하면 1개 값으로 N개가 발주됐다. INSERT 시 부모 주문 행을
--    FOR SHARE로 잠그고 재검사 → 선점(UPDATE)과 직렬화된다. 코드 측은 선점 후 품목 재확인(같은 날 커밋).
-- ② orders.payment_key 부분 유니크 — 다른 주문에서 승인된 paymentKey를 재사용한 확정을 DB가 거부.
-- ③ 주문 INSERT 가드 — 배송 필드 길이 상한 + 비회원 주문(create_guest_order, anon 호출) 전역 속도 제한.
-- ④ care_logs.logged_at 범위 강제 — 클라이언트만 검사해서 REST 직삽으로 한 주 7일치를 하루에 채워
--    주간 포인트(최대 300P)를 받을 수 있었다. 로그인 유저 쓰기만 대상(서비스 경로는 통과).
-- ⑤ pending 주문 삭제 정책에 payment_key is null — 결제 승인 진행 중 주문 삭제 차단.
-- ⑥ 주문 INSERT 정책에 후원 지정 고양이 소유 검사 — 남의 고양이 공개 기금 부풀리기 차단.
--
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행 확인(②가 실패하면 중복 결제키가 있는 것 — 아래 결과를 먼저 정리):
--   select payment_key, count(*) from orders where payment_key is not null group by 1 having count(*) > 1;
-- ══════════════════════════════════════════

-- ① order_items INSERT 시 부모 주문 잠금·재검사
create or replace function public.order_items_lock_parent()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text; v_key text;
begin
  select status, payment_key into v_status, v_key
    from orders where id = new.order_id for share;
  if not found then
    raise exception '주문을 찾을 수 없어요.';
  end if;
  if v_status <> 'pending' or v_key is not null then
    raise exception '결제가 진행 중이거나 끝난 주문에는 상품을 추가할 수 없어요.';
  end if;
  return new;
end $$;

drop trigger if exists order_items_lock_parent on public.order_items;
create trigger order_items_lock_parent
  before insert on public.order_items
  for each row execute function public.order_items_lock_parent();

-- ② 결제키 1개 = 주문 1개
create unique index if not exists orders_payment_key_uidx
  on public.orders (payment_key) where payment_key is not null;

-- ③ 주문 INSERT 가드
create or replace function public.orders_insert_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(new.recipient_name, '')) > 50
     or length(coalesce(new.recipient_phone, '')) > 20
     or length(coalesce(new.recipient_address, '')) > 200
     or length(coalesce(new.recipient_address_detail, '')) > 100
     or length(coalesce(new.postal_code, '')) > 10
     or length(coalesce(new.memo, '')) > 300 then
    raise exception '배송 정보가 너무 길어요.';
  end if;
  -- 비회원 주문은 유저 단위 제한이 없어(anon RPC) 전역 상한으로 도배만 막는다. 실수요는 분당 수 건 미만.
  if new.user_id is null and (
       (select count(*) from orders where user_id is null and created_at > now() - interval '1 minute') >= 20
    or (select count(*) from orders where user_id is null and created_at > now() - interval '1 hour') >= 200
  ) then
    raise exception '주문이 몰리고 있어요. 잠시 후 다시 시도해주세요.';
  end if;
  return new;
end $$;

drop trigger if exists orders_insert_guard on public.orders;
create trigger orders_insert_guard
  before insert on public.orders
  for each row execute function public.orders_insert_guard();

-- ④ care_logs.logged_at 범위 (로그인 유저 쓰기만 — 24시간 전 ~ 10분 후, 폰 시계 오차 허용)
create or replace function public.care_logs_logged_at_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (
       new.logged_at > now() + interval '10 minutes'
    or new.logged_at < now() - interval '24 hours'
  ) then
    raise exception '24시간 이내 기록만 가능해요.';
  end if;
  return new;
end $$;

drop trigger if exists care_logs_logged_at_guard on public.care_logs;
create trigger care_logs_logged_at_guard
  before insert or update of logged_at on public.care_logs
  for each row execute function public.care_logs_logged_at_guard();

-- ⑤ pending 주문 삭제: 결제 승인 진행 중이면 불가
drop policy if exists "orders_delete_own_pending" on public.orders;
create policy "orders_delete_own_pending"
  on public.orders for delete
  using (auth.uid() = user_id and status = 'pending' and payment_key is null);

-- ⑥ 주문 INSERT 정책: 후원 지정은 본인 등록묘만
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (
    auth.uid() = user_id
    and public.is_user_not_suspended(auth.uid())
    and status = 'pending'
    and payment_key is null
    and paid_at is null
    and tracking_number is null
    and (
      designated_cat_id is null
      or exists (select 1 from public.cats c where c.id = designated_cat_id and c.caretaker_id = auth.uid())
    )
  );

notify pgrst, 'reload schema';

-- ── 검증 ──
-- select tgname from pg_trigger where tgname in
--   ('order_items_lock_parent','orders_insert_guard','care_logs_logged_at_guard');   → 3행
-- select indexname from pg_indexes where indexname = 'orders_payment_key_uidx';      → 1행
-- select policyname, qual, with_check from pg_policies
--  where tablename = 'orders' and policyname in ('orders_delete_own_pending','orders_insert_own');
--   → delete qual에 payment_key IS NULL, insert with_check에 designated_cat_id 조건

-- ── 롤백 ──
-- drop trigger if exists order_items_lock_parent on public.order_items;
-- drop function if exists public.order_items_lock_parent();
-- drop index if exists public.orders_payment_key_uidx;
-- drop trigger if exists orders_insert_guard on public.orders;
-- drop function if exists public.orders_insert_guard();
-- drop trigger if exists care_logs_logged_at_guard on public.care_logs;
-- drop function if exists public.care_logs_logged_at_guard();
-- drop policy if exists "orders_delete_own_pending" on public.orders;
-- create policy "orders_delete_own_pending" on public.orders for delete
--   using (auth.uid() = user_id and status = 'pending');
-- drop policy if exists "orders_insert_own" on public.orders;
-- create policy "orders_insert_own" on public.orders for insert
--   with check (auth.uid() = user_id and public.is_user_not_suspended(auth.uid())
--     and status = 'pending' and payment_key is null and paid_at is null and tracking_number is null);
-- notify pgrst, 'reload schema';
-- 끝.
