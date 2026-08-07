-- ══════════════════════════════════════════
-- funnel_events step CHECK 확장 — cat_detail_view_anon 추가 (2026-08-07)
--
-- 왜: 8/18 판정의 전제가 되는 스텝이다. 지금은 onboarding_pick이 0으로 나와도
--     "동선이 안 닿아서 0"인지 "닿았는데 안 눌러서 0"인지 구분할 수 없다.
--     비로그인이 고양이 상세에 도달한 것을 pick 바로 앞단에서 잰다.
--
-- ⚠ 이 SQL을 실행하기 전에는 코드가 배포돼 있어도 계측이 쌓이지 않는다.
--    CHECK 제약에 걸려 INSERT가 실패하고 /api/funnel이 500을 반환한다.
--    (실제로 배포 후 프로브에서 500을 확인했다 — 조용히 0건이 될 뻔했다)
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_funnel_events_migration.sql, supabase_funnel_petition_steps_migration.sql
-- ══════════════════════════════════════════

alter table public.funnel_events drop constraint if exists funnel_events_step_check;

alter table public.funnel_events add constraint funnel_events_step_check check (step in (
  'onboarding_intro',
  'cat_detail_view_anon',
  'onboarding_pick',
  'signup_home',
  'first_feed',
  'petition_expand',
  'petition_click'
));

-- petition_* 두 스텝은 기능이 revert됐지만 기존 행(20건)이 남아 있어 CHECK에서 빼지 않는다.
-- 빼면 기존 행이 제약을 위반해 ALTER 자체가 실패한다.


-- ── 확인 (실행 후) ──
-- ⓐ 제약에 cat_detail_view_anon이 들어갔는지
select pg_get_constraintdef(oid) as constraint_def
  from pg_constraint
 where conrelid = 'public.funnel_events'::regclass
   and conname = 'funnel_events_step_check';

-- ⓑ 실제 삽입이 되는지는 앱에서 확인한다:
--    시크릿창 → 지도 → 고양이 마커 클릭 → 상세 진입
--    그 다음 아래로 집계 (1 이상이면 성공)
-- select step, count(*) from public.funnel_events group by step order by 2 desc;


-- ══════════════════════════════════════════
-- 롤백 (cat_detail_view_anon 행이 이미 쌓였으면 먼저 지워야 ALTER가 성공한다)
-- ══════════════════════════════════════════
-- delete from public.funnel_events where step = 'cat_detail_view_anon';
-- alter table public.funnel_events drop constraint if exists funnel_events_step_check;
-- alter table public.funnel_events add constraint funnel_events_step_check check (step in (
--   'onboarding_intro','onboarding_pick','signup_home','first_feed','petition_expand','petition_click'
-- ));
