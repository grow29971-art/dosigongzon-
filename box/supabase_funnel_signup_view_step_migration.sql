-- ══════════════════════════════════════════
-- funnel_events step CHECK 확장 — signup_view 추가 (2026-08-09)
--
-- 왜: 8/9 새벽 1시 24분, 이 앱 최초의 onboarding_pick 이 발생했다.
--       01:22:34 onboarding_intro → 01:24:24 cat_detail_view_anon → 01:24:28 onboarding_pick
--     상세 도달 4초 만에 "무료로 시작하기"를 눌렀다. 그런데 가입은 하지 않았다
--     (그 시각 전후 신규 가입 0건, 마지막 가입은 8/8 17:50).
--
--     즉 CTA 는 보이고 눌린다. 끊긴 곳은 pick 다음의 /signup 이고,
--     거기엔 계측이 하나도 없다. 가입 화면을 보긴 했는지, 약관에서 멈췄는지,
--     Turnstile 에서 막혔는지, 인앱브라우저 차단문(signup/page.tsx:151
--     "카카오톡에서는 가입이 안 돼요")을 만났는지 구분할 방법이 없다.
--     새벽 1시 + 외부 링크 유입이라 인앱브라우저 가능성이 높지만 추측일 뿐이다.
--
-- 이 스텝이 재는 것: pick 을 누른 사람이 /signup 화면에 실제로 도달했는가.
--   · signup_view 가 pick 과 같이 찍히면 → 가입 화면까지는 갔다. 폼/약관/봇검증 문제
--   · signup_view 가 안 찍히면 → 이동 자체가 실패. 인앱브라우저 차단·리다이렉트 문제
--
-- ⚠ 이 SQL 실행 전에는 코드가 배포돼 있어도 계측이 안 쌓인다.
--    CHECK 제약에 걸려 INSERT 가 실패하고 /api/funnel 이 500 을 반환한다.
--    (8/7 cat_detail_view_anon 때 실제로 겪었다 — 조용히 0건이 될 뻔했다)
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_funnel_cat_detail_step_migration.sql
-- ══════════════════════════════════════════

alter table public.funnel_events drop constraint if exists funnel_events_step_check;

alter table public.funnel_events add constraint funnel_events_step_check check (step in (
  'onboarding_intro',
  'cat_detail_view_anon',
  'onboarding_pick',
  'signup_view',
  'signup_home',
  'first_feed',
  'petition_expand',
  'petition_click'
));

-- petition_* 두 스텝은 기능이 revert됐지만 기존 행(20건)이 남아 있어 CHECK에서 빼지 않는다.
-- 빼면 기존 행이 제약을 위반해 ALTER 자체가 실패한다.

-- ── 검증 ──
-- insert into public.funnel_events (anon_id, step)
--   values ('00000000-0000-4000-8000-000000000000', 'signup_view');   -- 성공해야 함
-- delete from public.funnel_events where anon_id = '00000000-0000-4000-8000-000000000000';

-- ── 롤백 ──
-- alter table public.funnel_events drop constraint if exists funnel_events_step_check;
-- alter table public.funnel_events add constraint funnel_events_step_check check (step in (
--   'onboarding_intro','cat_detail_view_anon','onboarding_pick','signup_home','first_feed',
--   'petition_expand','petition_click'));
-- ⚠ 롤백 전에 signup_view 행을 먼저 지워야 ALTER 가 통과한다.
