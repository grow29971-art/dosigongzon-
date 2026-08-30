-- ══════════════════════════════════════════════════════════════
-- 후원 지정 배분 — 구매 후원(수익 10%)을 "내가 돌보는 고양이"에게 배정 (2026-08-30 사장님 요청)
-- ⚠ 후원 '금액'은 절대 안 바꾼다(트리거·게스트RPC·confirm·웹훅 4곳 공유 계약 그대로).
--   여기서 추가하는 건 "그 금액 중 몇 %를 어느 고양이에게 배정할지"라는 라벨(메타)뿐.
-- 실행: Supabase SQL Editor. 기존 주문은 ratio 0(전액 동네)으로 남는다.
-- ══════════════════════════════════════════════════════════════

-- 지정 고양이 — 내가 돌보는 등록묘(caretaker) 중 하나. 삭제돼도 주문은 남게 set null.
alter table public.orders
  add column if not exists designated_cat_id uuid references public.cats(id) on delete set null;

-- 자기 몫 비율(%) — 0~100. 0=전액 동네 기금, 70=내 아이 70%·동네 30%.
alter table public.orders
  add column if not exists donation_self_ratio int not null default 0;

alter table public.orders drop constraint if exists orders_donation_self_ratio_range;
alter table public.orders add constraint orders_donation_self_ratio_range
  check (donation_self_ratio >= 0 and donation_self_ratio <= 100);

-- 조회 성능 — 고양이별 배정 기금 집계용
create index if not exists idx_orders_designated_cat on public.orders(designated_cat_id)
  where designated_cat_id is not null;

-- 고양이별 배정 돌봄 기금(공개 집계) — 여러 구매자의 지정 몫 합산이라 per-user RLS를
-- 넘어야 해서 security definer. 후원금액 × 자기비율%, 결제완료(paid_at) 주문만.
create or replace function public.cat_designated_fund(p_cat_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(
    floor(
      (select coalesce(sum(oi.donation_amount), 0) from public.order_items oi where oi.order_id = o.id)
      * o.donation_self_ratio / 100.0
    )
  ), 0)::bigint
  from public.orders o
  where o.designated_cat_id = p_cat_id
    and o.donation_self_ratio > 0
    and o.paid_at is not null
    and o.status <> 'cancelled';
$$;
grant execute on function public.cat_designated_fund(uuid) to anon, authenticated;

-- 검증:
--   select column_name from information_schema.columns
--    where table_name='orders' and column_name in ('designated_cat_id','donation_self_ratio');
--   → 2행
--   select public.cat_designated_fund('00000000-0000-0000-0000-000000000000'); → 0

-- 롤백:
-- alter table public.orders drop column if exists designated_cat_id;
-- alter table public.orders drop column if exists donation_self_ratio;
