-- ══════════════════════════════════════════
-- 상품 후원 비율 5% → 10% (2026-08-17)
--
-- 왜: 사장님 지시로 쇼핑몰 후원 비율을 다시 10%로 상향.
--     (2026-08-07 supabase_shop_donation_5_migration.sql로 10%→5% 내렸던 것을 되돌림)
--
-- ⚠ 확인 필요: 2026-08-06 대주산업 제휴 공문에 "판매 수익의 5%를 TNR에 환원"으로
--    명시했었다(그래서 8/7에 5%로 맞춤). 10%로 올리면 DB가 그 공문보다 더 많이(10%)
--    약속하게 된다 — 소비자에게 불리하진 않으나 제휴사 공문·정산 기준과 어긋난다.
--    공문을 갱신했거나 상향이 의도된 결정인지 확인 후 실행할 것.
--
-- 범위: 일반 후원 상품(donation_percent < 100)만. 전액 후원 상품(100%)은 건드리지 않는다.
-- 과거 주문의 후원 스냅샷(order_items.donation_amount)은 주문 시점 고정값이라 불변(정상).
-- 코드 측 관리자 상품폼 기본값은 이미 10%라 별도 수정 없음.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query  (⚠ Chrome 번역 OFF)
-- ══════════════════════════════════════════

-- [실행 전] 현재 분포 확인 (5% → N종이 나올 것)
select donation_percent, count(*) as cnt
  from public.products
 group by donation_percent
 order by donation_percent;


-- [조치] 일반 상품만 10%로. 전액 후원 상품(100%)은 제외
update public.products
   set donation_percent = 10
 where donation_percent < 100;

-- 앞으로 등록하는 상품의 기본값도 10%
alter table public.products alter column donation_percent set default 10;


-- [확인] 10% → N종, 100%가 있으면 그대로 남아야 정상
select donation_percent, count(*) as cnt
  from public.products
 group by donation_percent
 order by donation_percent;


-- ══════════════════════════════════════════
-- 롤백 (5%로 되돌리기 — 공문 기준으로 복귀)
-- ══════════════════════════════════════════
-- update public.products set donation_percent = 5 where donation_percent < 100;
-- alter table public.products alter column donation_percent set default 5;
