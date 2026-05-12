-- ══════════════════════════════════════════
-- 도시공존 — region 카운트 RPC
-- 목적: HomeLanding/areas 페이지에서 cats 50,000행을 select 하는 패턴 제거.
--       region별 count만 반환해 egress를 ~1000배 절감.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

create or replace function public.cat_count_by_region()
returns table(region text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select region, count(*) as count
  from public.cats
  where region is not null and region <> ''
  group by region;
$$;

-- anon/authenticated 둘 다 호출 가능 (공개 통계)
grant execute on function public.cat_count_by_region() to anon, authenticated;

-- 보조 인덱스: group by region 성능 향상 (region이 null이 아닌 행만 인덱싱)
create index if not exists cats_region_idx
  on public.cats (region)
  where region is not null;
