-- ══════════════════════════════════════════
-- 온보딩 퍼널 계측 (funnel_events) 마이그레이션
-- 2026-07-18 전체회의 결정: 핸드오프와 계측을 한 묶음으로.
-- 퍼널: onboarding_intro → onboarding_pick → signup_home → first_feed
-- 기기(anon_id)당 스텝 1회만 기록 (unique) — 어뷰징 상한 겸 데이터 위생.
-- 실행: Supabase SQL Editor에서 전체 실행
-- ══════════════════════════════════════════

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null,
  step text not null check (step in ('onboarding_intro', 'onboarding_pick', 'signup_home', 'first_feed')),
  user_id uuid references auth.users (id) on delete set null,
  cat_id uuid,
  created_at timestamptz not null default now(),
  -- anon_id 위조 대비 길이 상한 (uuid 36자 + 여유)
  constraint funnel_events_anon_id_len check (char_length(anon_id) between 8 and 64)
);

-- 기기당 스텝 1회 — 클라이언트 upsert(ignoreDuplicates)의 근거이자 무한 삽입 어뷰징 상한
create unique index if not exists funnel_events_anon_step_uniq
  on public.funnel_events (anon_id, step);

-- 집계 쿼리용 (스텝별 카운트 / 기간 필터)
create index if not exists funnel_events_step_created_idx
  on public.funnel_events (step, created_at desc);

alter table public.funnel_events enable row level security;

-- INSERT: 비로그인(anon) 포함 누구나 — 단 user_id는 본인 또는 null만
drop policy if exists "funnel_events_insert" on public.funnel_events;
create policy "funnel_events_insert" on public.funnel_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- SELECT/UPDATE/DELETE: 정책 없음 → 클라이언트 불가, 집계는 service_role로만.

-- ══════════════════════════════════════════
-- 롤백 (전체 되돌리기)
-- drop table if exists public.funnel_events;
-- ══════════════════════════════════════════
