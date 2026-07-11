-- ══════════════════════════════════════════
-- 후원 비율 20% → 10% 조정 (2026-07-11 운영 결정)
-- - 일부 후원 상품(donation_percent < 100)의 비율을 10%로 변경
-- - 신규 상품 기본값도 10%로 변경
-- - 전액 후원(100%) 상품은 그대로 유지
-- - 이미 결제된 주문의 후원 스냅샷(order_items.donation_amount)은
--   주문 시점 기록이므로 건드리지 않음 (정상)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

update public.products
set donation_percent = 10
where is_donation = true
  and donation_percent < 100;

alter table public.products alter column donation_percent set default 10;

-- 확인용: 카테고리별 후원 비율 분포
select category, donation_percent, count(*)
from public.products
group by category, donation_percent
order by category;
-- 끝.
