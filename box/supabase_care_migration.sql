-- ══════════════════════════════════════════
-- 다마고치형 케어 시스템 마이그레이션 (2026-07-16)
-- 대상: cats (대표 고양이 케어 — profiles.rep_card_cat_id가 가리키는 내 고양이)
-- 설계: lazy decay — 게이지 값 저장 안 함, 기준 타임스탬프만. 크론 0.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.cats add column if not exists fed_at timestamptz;   -- 포만감 기준점 (gaugeTs 역산값)
alter table public.cats add column if not exists mood_at timestamptz;  -- 기분 기준점
alter table public.cats add column if not exists fed_day integer;      -- 급여한 게임일 번호 (KST 일수)
alter table public.cats add column if not exists fed_today integer not null default 0; -- 그 날 급여 횟수
alter table public.cats add column if not exists pet_day integer;      -- 쓰다듬은 게임일 번호
-- ⚠️ pet 게이트는 반드시 pet_day 전용 컬럼 사용 — mood_at 날짜로 판정하면
--    급여의 기분 회복이 mood_at을 오늘로 당겨 쓰다듬기를 오차단함 (냥줍 실버그).

-- 쓰기는 /api/care(service_role + 소유권 검증)에서만 수행하므로 RLS 정책 변경 불필요.
-- (cats SELECT 정책은 기존 그대로 — 케어 컬럼도 함께 읽힘)

-- 검증(실행 후):
--   select fed_at, mood_at, fed_day, fed_today, pet_day from public.cats limit 1;
--   → 42703 에러가 안 나면 성공. API는 마이그레이션 전 42703 감지 시 503(not_ready)로 안전 거절.

-- ── 롤백 ──
-- alter table public.cats drop column if exists fed_at;
-- alter table public.cats drop column if exists mood_at;
-- alter table public.cats drop column if exists fed_day;
-- alter table public.cats drop column if exists fed_today;
-- alter table public.cats drop column if exists pet_day;
