-- ══════════════════════════════════════════
-- 주문 택배사 컬럼 (2026-08-25)
-- 배송 조회 기능: 관리자가 운송장번호와 함께 택배사를 기록하면
-- 주문 상세의 "배송 조회하기" 버튼이 택배사+운송장 조회 검색으로 연결된다.
-- RLS 변경 없음 — 기존 orders 정책에 컬럼이 그대로 실린다.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.orders
  add column if not exists courier text;

comment on column public.orders.courier is
  '택배사 이름 (CJ대한통운 등). 운송장번호와 함께 배송 조회 링크 구성에 사용.';

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증: select column_name from information_schema.columns
--        where table_name = 'orders' and column_name = 'courier';  → 1행
-- 롤백: alter table public.orders drop column if exists courier;
--   (코드는 컬럼이 없으면 저장 시 자동 폴백하므로 코드 롤백 없이도 동작)
-- ══════════════════════════════════════════
-- 끝.
