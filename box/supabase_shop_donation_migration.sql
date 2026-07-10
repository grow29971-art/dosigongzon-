-- ══════════════════════════════════════════
-- 후원 루프: 주문 아이템별 후원액 스냅샷
-- 주문 시점의 (단가 × 수량 × donation_percent)를 고정 저장 —
-- 이후 상품의 후원 비율이 바뀌어도 과거 주문의 후원액은 불변 (회계 투명성).
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.order_items
  add column if not exists donation_amount integer not null default 0
  check (donation_amount >= 0);

comment on column public.order_items.donation_amount is
  '주문 시점 후원 적립액(원) 스냅샷 = 단가×수량×donation_percent/100 내림';

notify pgrst, 'reload schema';
-- 끝.
