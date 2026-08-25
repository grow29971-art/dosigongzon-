-- ══════════════════════════════════════════
-- 후원금 정산 일일 스냅샷 (2026-08-25)
-- 배경: 정산 카드(FundSettlementCard)가 매 요청 라이브 집계를 노출 → 구매 즉시 숫자가
--   올라가 개별 주문 금액이 역산됨(구매자 프라이버시) + 표시 시점마다 값이 흔들림.
-- 변경: 하루 1회(daily-dispatch 팬아웃, 09:00 KST) /api/cron/fund-snapshot이 집계해
--   이 단일행 테이블에 저장하고, 공개 API는 스냅샷만 읽는다. UI는 "기준 시각"을 표기.
--
-- 쓰기: service_role 전용(크론). 읽기도 서버 API가 service로 읽으므로
--   anon/authenticated 정책 없음 — RLS만 켜서 봉인.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.fund_snapshot (
  id smallint primary key default 1 check (id = 1), -- 단일행 강제
  collected integer not null default 0,             -- 모인 금액 (환불 차감 순액)
  spent integer not null default 0,                 -- 쓰인 금액 (fund_disbursements 합계)
  neutered_count integer not null default 0,        -- 후원금으로 중성화한 마릿수
  disbursements jsonb not null default '[]'::jsonb, -- 최근 지출 10건 [{amount,memo,spent_at}]
  snapped_at timestamptz not null default now()
);

alter table public.fund_snapshot enable row level security;
-- 정책 없음 = anon·authenticated 접근 불가. service_role만 읽고 쓴다.

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증 (첫 크론 발화 또는 수동 POST /api/cron/fund-snapshot 후):
--   select * from fund_snapshot;  → 1행, snapped_at이 최근이면 정상
--   anon으로 GET /rest/v1/fund_snapshot → [] (비노출)
-- 롤백 (되돌릴 때만):
--   drop table public.fund_snapshot;
--   + 코드 롤백: fund-settlement 라우트가 스냅샷 없으면 라이브 집계로 폴백하므로
--     테이블만 지워도 카드는 계속 동작한다(라이브 모드로 복귀).
-- ══════════════════════════════════════════
-- 끝.
