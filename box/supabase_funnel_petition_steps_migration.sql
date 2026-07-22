-- ══════════════════════════════════════════
-- funnel_events step CHECK 확장 — 청원 계측 스텝 추가 (2026-07-23)
-- 배경: 커뮤니티 청원 접이식 바 개편(bab5080)에서 petition_expand/petition_click
-- 스텝을 추가했으나 DB CHECK 제약이 기존 4개 스텝만 허용 → INSERT 거부(/api/funnel 500).
-- 프로덕션 E2E에서 실측 확인. UI 영향은 없음(fire-and-forget)이나 계측이 쌓이지 않음.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

alter table public.funnel_events
  drop constraint if exists funnel_events_step_check;

alter table public.funnel_events
  add constraint funnel_events_step_check check (step in (
    'onboarding_intro',
    'onboarding_pick',
    'signup_home',
    'first_feed',
    'petition_expand',
    'petition_click'
  ));

-- 검증: 아래가 1행(제약 존재) 반환하면 성공
-- select conname from pg_constraint
--   where conrelid = 'public.funnel_events'::regclass and conname = 'funnel_events_step_check';

-- ── 롤백 ──
-- alter table public.funnel_events drop constraint if exists funnel_events_step_check;
-- alter table public.funnel_events
--   add constraint funnel_events_step_check check (step in (
--     'onboarding_intro', 'onboarding_pick', 'signup_home', 'first_feed'
--   ));
-- (롤백 전 petition_* 행이 이미 쌓였다면 먼저 삭제 필요:
--  delete from public.funnel_events where step in ('petition_expand', 'petition_click');)
