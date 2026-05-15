-- ══════════════════════════════════════════════════════════════
-- 도시공존 — 가입 후 이탈·리텐션 진단 (2026-05-15)
-- 목적: 광고로 들어온 유저가 어디서 이탈하는지 데이터로 파악.
-- 각 블록은 독립 실행 가능. SQL Editor에서 블록별로 Run.
-- ══════════════════════════════════════════════════════════════


-- ─── ① 가입자 일별 추이 (최근 30일) ───────────────────────────
-- 광고 효율 시계열. 가입 폭증/급락 시점 보기.
select
  date_trunc('day', created_at)::date as signup_date,
  count(*) as signups
from public.profiles
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;


-- ─── ② 가입 → 첫 cat 등록 전환율 ──────────────────────────────
-- "광고 클릭한 사람이 실제로 한 번이라도 등록했는가?"
-- 이 비율이 낮으면 onboarding·첫 행동 흐름이 문제.
with cohort as (
  select
    p.id,
    p.created_at as signup_at,
    (select min(c.created_at) from public.cats c where c.caretaker_id = p.id) as first_cat_at
  from public.profiles p
)
select
  count(*) as total_signups,
  count(first_cat_at) as registered_any_cat,
  round(100.0 * count(first_cat_at) / nullif(count(*), 0), 1) as activation_pct,
  round(avg(extract(epoch from (first_cat_at - signup_at)) / 3600)::numeric, 1) as avg_hours_to_first_cat,
  round(percentile_cont(0.5) within group (order by extract(epoch from (first_cat_at - signup_at)) / 3600)::numeric, 1) as median_hours
from cohort;


-- ─── ③ 가입 → "활동 1회 이상" 전환율 (cat·comment·care_log 통합) ───
-- cat 등록 안 해도 댓글이나 돌봄 기록 남겼으면 활성.
with first_act as (
  select
    p.id,
    p.created_at as signup_at,
    least(
      coalesce((select min(c.created_at)  from public.cats        c  where c.caretaker_id = p.id), 'infinity'::timestamptz),
      coalesce((select min(cc.created_at) from public.cat_comments cc where cc.author_id   = p.id), 'infinity'::timestamptz),
      coalesce((select min(cl.created_at) from public.care_logs   cl where cl.author_id    = p.id), 'infinity'::timestamptz)
    ) as first_activity_at
  from public.profiles p
)
select
  count(*) as total_signups,
  count(*) filter (where first_activity_at < 'infinity'::timestamptz) as activated_users,
  round(100.0 * count(*) filter (where first_activity_at < 'infinity'::timestamptz) / nullif(count(*), 0), 1) as activation_pct
from first_act;


-- ─── ④ D1 / D3 / D7 / D14 / D30 retention (방문 기준) ────────────
-- daily_visits에 가입 후 N일째 본인의 visit이 찍혔는지.
-- 광고 retention의 핵심 지표.
with base as (
  select
    p.id as user_id,
    p.created_at::date as signup_date
  from public.profiles p
  where p.created_at >= now() - interval '30 days'
)
select
  count(*) as cohort_size,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.daily_visits d
    where d.user_id = b.user_id
      and d.date = b.signup_date + interval '1 day'
  )) / nullif(count(*), 0), 1) as d1_retention_pct,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.daily_visits d
    where d.user_id = b.user_id
      and d.date = b.signup_date + interval '3 days'
  )) / nullif(count(*), 0), 1) as d3_retention_pct,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.daily_visits d
    where d.user_id = b.user_id
      and d.date = b.signup_date + interval '7 days'
  )) / nullif(count(*), 0), 1) as d7_retention_pct,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.daily_visits d
    where d.user_id = b.user_id
      and d.date between b.signup_date + interval '8 days' and b.signup_date + interval '14 days'
  )) / nullif(count(*), 0), 1) as d8_14_retention_pct,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.daily_visits d
    where d.user_id = b.user_id
      and d.date between b.signup_date + interval '15 days' and b.signup_date + interval '30 days'
  )) / nullif(count(*), 0), 1) as d15_30_retention_pct
from base b;


-- ─── ⑤ 활성 vs 휴면 사용자 분포 ────────────────────────────────
-- "DAU/WAU/MAU·휴면" 한눈에. 사용자가 광고로 들어와 어디로 빠지는지.
with user_last as (
  select
    p.id,
    p.created_at,
    greatest(
      p.created_at,
      coalesce((select max(c.created_at)  from public.cats        c  where c.caretaker_id = p.id), p.created_at),
      coalesce((select max(cc.created_at) from public.cat_comments cc where cc.author_id   = p.id), p.created_at),
      coalesce((select max(cl.created_at) from public.care_logs   cl where cl.author_id    = p.id), p.created_at),
      coalesce((select max(d.date)::timestamptz from public.daily_visits d where d.user_id = p.id), p.created_at)
    ) as last_active_at
  from public.profiles p
)
select
  case
    when last_active_at > now() - interval '1 day'  then '1. DAU (≤1d)'
    when last_active_at > now() - interval '7 days' then '2. WAU (≤7d)'
    when last_active_at > now() - interval '30 days' then '3. MAU (≤30d)'
    else '4. Dormant (>30d)'
  end as bucket,
  count(*) as users
from user_last
group by 1
order by 1;


-- ─── ⑥ 동(region) 단위 활성도 — 광고 집중 지역 자동 결정 ────────
-- 캣맘 수 + 최근 활동이 살아있는 동네 = 광고 ROI 최고 지역.
select
  region,
  count(distinct caretaker_id) as active_caretakers,
  count(*) as cat_count,
  max(created_at)::date as latest_cat_added,
  count(*) filter (where created_at > now() - interval '14 days') as cats_added_14d
from public.cats
where region is not null and region <> ''
group by region
order by active_caretakers desc, cats_added_14d desc
limit 20;


-- ─── ⑦ 푸시 구독률 ────────────────────────────────────────────
-- 푸시 거부율 높으면 PushOptInCard 노출 시점·문구 개편 필요.
select
  count(distinct p.id) as total_users,
  count(distinct ps.user_id) as push_subscribed_users,
  round(100.0 * count(distinct ps.user_id) / nullif(count(distinct p.id), 0), 1) as push_subscription_pct
from public.profiles p
left join public.push_subscriptions ps on ps.user_id = p.id;


-- ─── ⑧ "유령 가입자" — 가입만 하고 단 한 번도 활동 없는 사용자 ─
-- 광고 들어와 가입한 직후 닫고 다시는 안 본 사람들. 비율이 높으면
-- onboarding 또는 광고 LP가 기대를 못 채운 것.
with activity as (
  select
    p.id,
    p.created_at,
    (select count(*) from public.cats         c  where c.caretaker_id = p.id) +
    (select count(*) from public.cat_comments cc where cc.author_id   = p.id) +
    (select count(*) from public.care_logs   cl where cl.author_id    = p.id) as total_actions,
    (select count(*) from public.daily_visits d where d.user_id = p.id) as total_visit_days
  from public.profiles p
)
select
  count(*) as total_users,
  count(*) filter (where total_actions = 0 and total_visit_days <= 1) as ghost_users,
  count(*) filter (where total_actions = 0 and total_visit_days >  1) as visit_only_users,
  count(*) filter (where total_actions between 1 and 3) as light_users,
  count(*) filter (where total_actions >= 4) as active_users,
  round(100.0 * count(*) filter (where total_actions = 0 and total_visit_days <= 1) / nullif(count(*), 0), 1) as ghost_pct
from activity;


-- ─── ⑨ 가입 시간대 분포 — 광고 노출 시간 최적화 ────────────────
select
  extract(hour from created_at at time zone 'Asia/Seoul')::int as hour_kst,
  count(*) as signups
from public.profiles
where created_at >= now() - interval '30 days'
group by 1
order by 2 desc;
