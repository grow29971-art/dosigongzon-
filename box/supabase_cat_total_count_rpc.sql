-- ══════════════════════════════════════════
-- 도시공존 — 전체 고양이 카운트 RPC (visibility 무시, hidden만 제외)
-- 목적: HomeLanding·about·OG 등에서 "전국 N마리" 통계가 private/circle 핀까지
--       포함해 보이도록. 식별 정보(개별 row)는 RLS로 차단되지만 카운트는 모두에게 노출.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_migration.sql, supabase_auto_hide_reported_migration.sql
-- ══════════════════════════════════════════

create or replace function public.total_cat_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
  from public.cats
  where hidden = false;
$$;

grant execute on function public.total_cat_count() to anon, authenticated;

-- 위험 상황(health_status='danger') 카운트도 동일 패턴
create or replace function public.total_danger_cat_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
  from public.cats
  where hidden = false and health_status = 'danger';
$$;

grant execute on function public.total_danger_cat_count() to anon, authenticated;

-- 최근 7일 신규 등록 카운트 (활발한 동네용 — 개수만, 좌표·사진·이름 노출 X)
create or replace function public.recent_cat_count_by_region(days int default 7)
returns table(region text, recent_count bigint, active_caretakers bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    region,
    count(*)::bigint as recent_count,
    count(distinct caretaker_id) filter (where caretaker_id is not null)::bigint as active_caretakers
  from public.cats
  where region is not null
    and region <> ''
    and hidden = false
    and created_at >= now() - (days || ' days')::interval
  group by region;
$$;

grant execute on function public.recent_cat_count_by_region(int) to anon, authenticated;
