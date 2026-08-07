-- ══════════════════════════════════════════
-- 상품 후원 비율 10% → 5% (2026-08-07)
--
-- 왜: 2026-08-06 대주산업에 발송한 제휴 공문에 **"판매 수익의 5%를 TNR에 환원"**
--     으로 명시했는데 DB는 10%였다. 대외 문서와 실제 동작이 다르면 미팅에서
--     계산이 안 맞고, 그 자리에서 신뢰를 잃는다. 공문 기준으로 통일한다.
--
-- 함께 정리: 화면 문구를 "수익의 일부" → "결제 금액의 5%"로 명확히 했다.
--   "수익"은 이익/매출 어느 쪽인지 모호해 소비자가 이익 기준으로 읽을 수 있고,
--   실제 코드는 결제 금액 기준이라 표시광고법상 다툼 소지가 된다.
--
-- 100% 후원 상품(가상 후원 상품)은 건드리지 않는다.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

-- [실행 전] 현재 분포 확인 (10% → 18종이 나올 것)
select donation_percent, count(*) as cnt
  from public.products
 group by donation_percent
 order by donation_percent;


-- [조치] 일반 상품만 5%로. 전액 후원 상품(100%)은 제외
update public.products
   set donation_percent = 5
 where donation_percent < 100;

-- 앞으로 등록하는 상품의 기본값도 5%
alter table public.products alter column donation_percent set default 5;


-- [확인] 5% → 18종, 100%가 있으면 그대로 남아야 정상
select donation_percent, count(*) as cnt
  from public.products
 group by donation_percent
 order by donation_percent;


-- ══════════════════════════════════════════
-- 롤백 (10%로 되돌리기)
-- ══════════════════════════════════════════
-- update public.products set donation_percent = 10 where donation_percent < 100;
-- alter table public.products alter column donation_percent set default 10;
