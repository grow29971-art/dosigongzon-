-- ══════════════════════════════════════════
-- 핵심 여정 개편 P0 — 기준 지표(baseline) 일괄 측정 스크립트 (2026-07-26)
-- 목적: box/개발일지_20260726_핵심여정개편.md §4 표의 7개 지표를
--   한 번의 실행으로 재현 가능하게 산출한다. 개편 전/후 비교의 기준선.
-- 실행: Supabase Dashboard → SQL Editor → 전체 실행.
--   ⚠ 읽기 전용(SELECT만) — 테이블/데이터 변경 없음. 롤백 불필요.
-- 정의 출처(코드와 일치 유지):
--   · 활동(act) 정의 = box/supabase_analytics_real_metrics.sql [D]와 동일
--     (cats/posts/direct_messages/care_logs 4종 행동 union)
--   · 퍼널 스텝 = lib/funnel-repo.ts FunnelStep / app/api/funnel/route.ts VALID_STEPS
--   · 푸시 옵트인 = public.push_subscriptions (app/api/push/subscribe/route.ts)
-- ⚠ FOUNDER uid(운영자 제외용)가 본인 맞는지 먼저 확인하고 필요시 교체.
-- ⚠ funnel_events는 2026-07-22 저녁 이후만 신뢰 가능(그 전엔 RLS 거부로 유실)
--   → 퍼널 집계는 '2026-07-22 12:00 UTC' 이후로 필터.
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- [1] 요약 지표 7종 — §4 표에 그대로 옮겨 적는 블록
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
act as (
  select caretaker_id as user_id, created_at as at from public.cats where caretaker_id is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select sender_id, created_at from public.direct_messages where sender_id is not null
  union all select author_id, logged_at from public.care_logs where author_id is not null
),
first_care as (
  select author_id as uid, min(logged_at) as t from public.care_logs group by author_id
)
select '측정시각(UTC)' as 지표, now()::text as 값
union all select '진짜 WAU (최근7일 활동유저, 운영자 제외)',
  (select count(distinct user_id) from act
    where user_id <> (select uid from founder) and at >= now() - interval '7 days')::text
union all select '주간 케어기록 수 [북극성] (최근7일, 운영자 제외)',
  (select count(*) from public.care_logs
    where logged_at >= now() - interval '7 days'
      and author_id <> (select uid from founder))::text
union all select '주간 케어기록 수 (최근7일, 전체)',
  (select count(*) from public.care_logs where logged_at >= now() - interval '7 days')::text
union all select '푸시 옵트인 수 (구독행 / 고유유저)',
  (select count(*)::text || ' / ' || count(distinct user_id)::text from public.push_subscriptions)
union all select '첫밥(첫 케어) 도달 수 (최근7일에 첫 케어한 유저)',
  (select count(*) from first_care where t >= now() - interval '7 days')::text
union all select '신규 가입 수 (최근7일)',
  (select count(*) from public.profiles where created_at >= now() - interval '7 days')::text;

-- ──────────────────────────────────────────
-- [2] Day0 활성화율 — 가입 당일(KST) 4종 행동 중 하나라도 한 비율
--     retention 회의(7/22) 정의: "가입 당일 첫 행동 도달". 운영자 제외.
--     전체 누적 + 최근 28일 가입 코호트 두 줄 (소표본이라 %는 방향 참고용).
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
act as (
  select caretaker_id as user_id, created_at as at from public.cats where caretaker_id is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select sender_id, created_at from public.direct_messages where sender_id is not null
  union all select author_id, logged_at from public.care_logs where author_id is not null
),
u as (
  select id, created_at,
    exists (
      select 1 from act a
      where a.user_id = u0.id
        and (a.at at time zone 'Asia/Seoul')::date = (u0.created_at at time zone 'Asia/Seoul')::date
    ) as day0_active
  from public.profiles u0
  where u0.id <> (select uid from founder)
)
select '전체 누적' as 코호트, count(*) as 가입,
       count(*) filter (where day0_active) as day0활성,
       round(100.0 * count(*) filter (where day0_active) / nullif(count(*), 0), 1) as day0활성화율_pct
from u
union all
select '최근 28일 가입', count(*),
       count(*) filter (where day0_active),
       round(100.0 * count(*) filter (where day0_active) / nullif(count(*), 0), 1)
from u where created_at >= now() - interval '28 days';

-- ──────────────────────────────────────────
-- [3] 퍼널 스텝별 도달 기기 수 — funnel_events (기기 anon_id 단위, 스텝당 1회)
--     핵심 4스텝 순서: onboarding_intro → onboarding_pick → signup_home → first_feed
--     (petition_* 2스텝은 부가 계측 — 핵심 여정 전환율 계산에서 제외)
--     전환율 = 다음 스텝 도달수 / 이전 스텝 도달수 (표에는 스텝별 수와 함께 기입).
-- ──────────────────────────────────────────
select step as 스텝,
       count(distinct anon_id) as 도달기기수,
       min(created_at)::date as 최초기록일,
       max(created_at)::date as 최근기록일
from public.funnel_events
where created_at >= '2026-07-22 12:00+00'  -- 계측 정상화 이후만
group by step
order by array_position(
  array['onboarding_intro','onboarding_pick','signup_home','first_feed','petition_expand','petition_click'],
  step);

-- ──────────────────────────────────────────
-- [4] 주 단위 추이 (최근 8주, KST 주 시작일 기준) — 기준선의 맥락용
--     신규가입 / 케어기록 / 첫밥 도달 유저를 주별로.
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
first_care as (
  select author_id as uid, min(logged_at) as t from public.care_logs group by author_id
),
weeks as (
  select date_trunc('week', (now() at time zone 'Asia/Seoul'))::date - (n * 7) as wk
  from generate_series(0, 7) n
)
select w.wk as 주시작_KST,
  (select count(*) from public.profiles p
    where date_trunc('week', p.created_at at time zone 'Asia/Seoul')::date = w.wk) as 신규가입,
  (select count(*) from public.care_logs cl
    where date_trunc('week', cl.logged_at at time zone 'Asia/Seoul')::date = w.wk
      and cl.author_id <> (select uid from founder)) as 케어기록_운영자제외,
  (select count(*) from first_care fc
    where date_trunc('week', fc.t at time zone 'Asia/Seoul')::date = w.wk) as 첫밥도달유저
from weeks w
order by w.wk desc;

-- ══════════════════════════════════════════
-- 롤백: 불필요 — 본 스크립트는 SELECT만 수행하며 어떤 객체/데이터도 만들거나
--        변경하지 않는다.
-- ══════════════════════════════════════════
