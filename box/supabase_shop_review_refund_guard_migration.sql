-- ══════════════════════════════════════════
-- 환불·취소 시 구매후기 자동 숨김 (2026-08-20 원탁회의 P0 — 리뷰 세탁 봇 방어)
-- 공격 시나리오: 최저가 상품 결제 → 별점5 후기 작성 → 즉시 환불 반복(다중 계정) = 별점 조작.
--   후기 작성 RLS는 "작성 시점"의 주문 상태만 보므로, 환불 이후를 DB 트리거로 닫는다.
-- 동작: orders.status가 refunded/cancelled로 전이되면 그 주문 품목에 대한
--   해당 유저의 후기를 hidden 처리(삭제 아님 — 분쟁 대비 보존). 부분환불은 유지.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_reviews_migration.sql
-- ══════════════════════════════════════════

-- ── 1. hidden 컬럼 ──
alter table public.product_reviews add column if not exists hidden boolean not null default false;

-- ── 2. 읽기 정책 교체 — 숨긴 후기는 본인·관리자만 조회 ──
drop policy if exists "product_reviews_read_all" on public.product_reviews;
create policy "product_reviews_read_all"
  on public.product_reviews for select
  using (
    not hidden
    or auth.uid() = user_id
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

-- ── 3. 환불·취소 전이 트리거 ──
create or replace function public.hide_reviews_on_refund()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('refunded', 'cancelled')
     and old.status is distinct from new.status
     and new.user_id is not null then
    update public.product_reviews pr
       set hidden = true
     where pr.user_id = new.user_id
       and pr.product_id in (
         select oi.product_id from public.order_items oi
          where oi.order_id = new.id and oi.product_id is not null
       )
       -- 같은 상품을 다른 유효 주문으로도 샀다면 후기를 유지한다
       and not exists (
         select 1 from public.orders o2
         join public.order_items oi2 on oi2.order_id = o2.id
         where o2.user_id = new.user_id
           and o2.id <> new.id
           and oi2.product_id = pr.product_id
           and o2.status in ('paid', 'preparing', 'shipping', 'delivered')
       );
  end if;
  return new;
end $$;

drop trigger if exists orders_hide_reviews_on_refund on public.orders;
create trigger orders_hide_reviews_on_refund
  after update on public.orders
  for each row execute function public.hide_reviews_on_refund();

notify pgrst, 'reload schema';

-- 검증(프로브): 구매→후기작성→주문 refunded 전환 시 anon select에서 해당 후기가 사라지면 통과.

-- ══════════════════════════════════════════
-- 롤백 (되돌릴 때만 실행)
-- drop trigger if exists orders_hide_reviews_on_refund on public.orders;
-- drop function if exists public.hide_reviews_on_refund();
-- drop policy if exists "product_reviews_read_all" on public.product_reviews;
-- create policy "product_reviews_read_all" on public.product_reviews for select using (true);
-- alter table public.product_reviews drop column if exists hidden;
-- ══════════════════════════════════════════
-- 끝.
