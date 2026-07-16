-- 도시공존 — 주간 배틀 지급 멱등화 (2026-07-16 감사 M4)
-- 문제: /api/cron/weekly-battle-payout이 코인을 read-modify-write로 지급하고
--   "이번 주 이미 지급" 기록이 없어, Vercel 크론이 한 번 재시도하면 TOP10 코인이
--   2배 지급됨. 게다가 비원자 update라 동시 코인 변경과 갱신 소실.
-- 해결: (week_start, user_id) 유니크 지급대장 — 먼저 insert가 성공한 경우에만 지급.
--   재실행 시 23505(중복)로 건너뜀. 코인은 increment_coins RPC로 원자 지급.
-- 코드는 테이블 없으면(42P01) 기존 동작으로 폴백하므로 실행 전에도 안전.

create table if not exists public.weekly_payouts (
  week_start timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null default 0,
  reward int not null default 0,
  paid_at timestamptz not null default now(),
  primary key (week_start, user_id)
);

-- RLS: 정책 없이 활성화만 — anon/authenticated 전부 거부, service_role(크론)만 사용
alter table public.weekly_payouts enable row level security;

-- ─────────────────────────────────────────────
-- 롤백: drop table if exists public.weekly_payouts;
-- ─────────────────────────────────────────────
