-- Core journey baseline diagnostics (read-only)
-- Target project: sozxbnvgsougkliibnxl
-- This script only performs SELECT queries.

with founder as (
  select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid
),
activity as (
  select caretaker_id as user_id, created_at as occurred_at
  from public.cats
  where caretaker_id is not null
  union all
  select author_id, created_at
  from public.posts
  where author_id is not null
  union all
  select sender_id, created_at
  from public.direct_messages
  where sender_id is not null
  union all
  select author_id, logged_at
  from public.care_logs
  where author_id is not null
),
first_care as (
  select author_id as user_id, min(logged_at) as first_care_at
  from public.care_logs
  group by author_id
)
select 'measured_at_utc' as metric, now()::text as value
union all
select 'weekly_active_users_excluding_founder',
  (
    select count(distinct user_id)::text
    from activity
    where user_id <> (select uid from founder)
      and occurred_at >= now() - interval '7 days'
  )
union all
select 'weekly_care_logs_excluding_founder',
  (
    select count(*)::text
    from public.care_logs
    where logged_at >= now() - interval '7 days'
      and author_id <> (select uid from founder)
  )
union all
select 'weekly_care_logs_total',
  (
    select count(*)::text
    from public.care_logs
    where logged_at >= now() - interval '7 days'
  )
union all
select 'push_subscriptions_total_and_users',
  (
    select count(*)::text || ' / ' || count(distinct user_id)::text
    from public.push_subscriptions
  )
union all
select 'first_care_users_last_7_days',
  (
    select count(*)::text
    from first_care
    where first_care_at >= now() - interval '7 days'
  )
union all
select 'new_profiles_last_7_days',
  (
    select count(*)::text
    from public.profiles
    where created_at >= now() - interval '7 days'
  );

with founder as (
  select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid
),
activity as (
  select caretaker_id as user_id, created_at as occurred_at
  from public.cats
  where caretaker_id is not null
  union all
  select author_id, created_at
  from public.posts
  where author_id is not null
  union all
  select sender_id, created_at
  from public.direct_messages
  where sender_id is not null
  union all
  select author_id, logged_at
  from public.care_logs
  where author_id is not null
),
users as (
  select
    profile.id,
    profile.created_at,
    exists (
      select 1
      from activity
      where activity.user_id = profile.id
        and (activity.occurred_at at time zone 'Asia/Seoul')::date =
            (profile.created_at at time zone 'Asia/Seoul')::date
    ) as day0_active
  from public.profiles as profile
  where profile.id <> (select uid from founder)
)
select
  'all_time' as cohort,
  count(*) as signups,
  count(*) filter (where day0_active) as day0_active_users,
  round(
    100.0 * count(*) filter (where day0_active) / nullif(count(*), 0),
    1
  ) as day0_activation_rate_pct
from users
union all
select
  'last_28_days',
  count(*),
  count(*) filter (where day0_active),
  round(
    100.0 * count(*) filter (where day0_active) / nullif(count(*), 0),
    1
  )
from users
where created_at >= now() - interval '28 days';

select
  step,
  count(distinct anon_id) as devices,
  min(created_at)::date as first_seen_date,
  max(created_at)::date as last_seen_date
from public.funnel_events
where created_at >= '2026-07-22 12:00+00'
group by step
order by array_position(
  array[
    'onboarding_intro',
    'onboarding_pick',
    'signup_home',
    'first_feed',
    'petition_expand',
    'petition_click'
  ],
  step
);

with founder as (
  select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid
),
first_care as (
  select author_id as user_id, min(logged_at) as first_care_at
  from public.care_logs
  group by author_id
),
weeks as (
  select
    date_trunc('week', now() at time zone 'Asia/Seoul')::date - (n * 7) as week_start
  from generate_series(0, 7) as n
)
select
  weeks.week_start,
  (
    select count(*)
    from public.profiles
    where date_trunc('week', created_at at time zone 'Asia/Seoul')::date =
          weeks.week_start
  ) as new_profiles,
  (
    select count(*)
    from public.care_logs
    where date_trunc('week', logged_at at time zone 'Asia/Seoul')::date =
          weeks.week_start
      and author_id <> (select uid from founder)
  ) as care_logs_excluding_founder,
  (
    select count(*)
    from first_care
    where date_trunc('week', first_care_at at time zone 'Asia/Seoul')::date =
          weeks.week_start
  ) as first_care_users
from weeks
order by weeks.week_start desc;
