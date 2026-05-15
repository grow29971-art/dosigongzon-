-- ════════════════════════════════════════════════════════════
-- 도시공존 — 리텐션 핵심 3블록 (④⑥⑧)
-- 한 번에 Run하면 마지막 결과만 보이므로 블록별로 따로 Run.
-- 1) 블록 선택 → 2) Ctrl+Enter → 3) 결과 캡처
-- ════════════════════════════════════════════════════════════


-- ─── ④ D1/D3/D7/D14/D30 retention ─────────────────────────────
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


-- ─── ⑥ 동(region) 활성도 — 광고 집중 지역 결정 ─────────────
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


-- ─── ⑧ 유령 가입자 비율 ───────────────────────────────────
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
