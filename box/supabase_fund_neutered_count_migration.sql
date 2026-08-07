-- ══════════════════════════════════════════
-- 후원금 집행 내역에 "중성화 마릿수" 기록 (2026-08-07)
--
-- 왜: 쇼핑 정산 카드에 "후원금으로 중성화한 아이 N마리"를 표시한다.
--     모인 금액 옆에 실제 성과를 함께 두는 것이 투명 정산의 취지다.
--     지금은 집행 실적이 없어 0마리이고, 0을 그대로 보여준다.
--
-- 이 컬럼이 없어도 화면은 0으로 정상 표시된다(API가 조용히 폴백).
-- 다만 조회 때마다 오류 응답이 발생하므로 실행해두는 편이 깔끔하다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_fund_settlement_migration.sql
-- ══════════════════════════════════════════

alter table public.fund_disbursements
  add column if not exists neutered_count integer not null default 0;

comment on column public.fund_disbursements.neutered_count is
  '이 집행으로 중성화한 고양이 수. 쇼핑 정산 카드의 "후원금으로 중성화한 아이"에 합산된다.';


-- ── 확인 (실행 후) ──
-- 한 줄 나오면 성공
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'fund_disbursements'
   and column_name = 'neutered_count';


-- ── 사용법 (나중에 실제로 집행했을 때) ──
-- insert into public.fund_disbursements (amount, memo, spent_at, neutered_count)
-- values (150000, '○○동 길고양이 TNR 3마리', now(), 3);


-- ══════════════════════════════════════════
-- 롤백
-- ══════════════════════════════════════════
-- alter table public.fund_disbursements drop column if exists neutered_count;
