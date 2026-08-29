-- ══════════════════════════════════════════════════════════════
-- fund_disbursements 세무 증빙 필드 추가 (2026-08-29 법률감사 M5)
-- 후원금 지출을 "기부금"이 아닌 "판매촉진비/광고선전비"로 구성하려면 수령처·지급증빙이
-- 필요(지정기부금단체·영수증 없이도 경비 인정). 잘못 분류하면 소급 추징 리스크.
-- 실행: Supabase SQL Editor. 기존 지출 데이터는 null로 남고, 앞으로 관리자 폼에서 입력.
-- ══════════════════════════════════════════════════════════════

alter table public.fund_disbursements add column if not exists recipient text;
alter table public.fund_disbursements add column if not exists evidence_url text;

-- 검증:
--   select column_name from information_schema.columns
--    where table_name='fund_disbursements' and column_name in ('recipient','evidence_url');
--   → 2행 나와야 정상

-- 롤백:
-- alter table public.fund_disbursements drop column if exists recipient;
-- alter table public.fund_disbursements drop column if exists evidence_url;
