-- ══════════════════════════════════════════
-- calc_distance_m double precision overload (2026-04-24)
-- 증상: 고양이 위치 수정 시
--   "function public.calc_distance_m(double precision, double precision,
--    double precision, double precision) does not exist"
-- 원인: cats.lat/lng 컬럼이 double precision인데 함수는 numeric 시그니처
--       → 트리거 public.log_cat_location_change() 안 호출이 매칭 실패
-- fix: double precision 버전 함수를 overload로 추가 (기존 numeric 함수 유지)
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

create or replace function public.calc_distance_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision
language plpgsql
immutable
as $$
declare
  r double precision := 6371000;
  dlat double precision;
  dlng double precision;
  a double precision;
begin
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2) * sin(dlat/2)
       + cos(radians(lat1)) * cos(radians(lat2))
       * sin(dlng/2) * sin(dlng/2);
  return round((r * 2 * atan2(sqrt(a), sqrt(1 - a)))::numeric, 1)::double precision;
end;
$$;

-- 확인: 함수 존재·시그니처 점검
-- select proname, pg_get_function_arguments(oid)
-- from pg_proc
-- where proname = 'calc_distance_m';
-- → 두 개 행(numeric 버전 + double precision 버전)이 나와야 정상.

notify pgrst, 'reload schema';
-- 끝.
