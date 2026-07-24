-- ══════════════════════════════════════════
-- cats anon 좌표 노출 잠금 (2026-07-24 회의 선결과제)
-- 배경(개발일지 20260722 §백로그): anon REST가 cats를 select("*")로 읽으면
-- 저장 좌표(±444m 퍼징)+caretaker_id가 화면 표시(±900m+배회)보다 정밀하게 노출.
-- 학대 악용 리스크 — 유입 캠페인 전 선결 조건.
--
-- 설계 (profiles_public_view 선례와 동일 패턴):
--   [STEP A] cats_public_map 뷰 신설 — lat/lng에 개체별 고정 지터 ±약450m 추가
--            (기기·시간 무관 결정적 → 여러 번 조회해 평균내는 통계 공격 불가).
--            공개 행(hidden=false, visibility='public')만.
--   [STEP B] cats base 테이블의 anon SELECT를 컬럼 단위로 재부여 — lat/lng만 제외.
--            (lat/lng를 읽는 anon 경로 3곳은 코드가 뷰로 이관 배포된 뒤 실행!)
--
-- ⚠ 실행 순서 게이트:
--   1) STEP A 실행 → 2) 코드 배포(뷰 이관) 확인 → 3) STEP B 실행 → 4) 검증 쿼리
--   STEP B를 먼저 실행하면 배포 전 클라이언트의 지도/상세(비로그인)가 깨진다.
-- ══════════════════════════════════════════

-- ────────────────────────────────
-- STEP A. 공개 지도용 뷰 (지금 바로 실행 가능 — 순수 추가)
-- ────────────────────────────────
do $$
declare
  cols text;
begin
  -- lat/lng 제외 전 컬럼 (스키마 드리프트에 안전)
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cats'
     and column_name not in ('lat', 'lng');

  -- 뷰는 owner(postgres) 권한으로 실행돼 base RLS/grant와 무관하게 동작 —
  -- 대신 공개 조건(hidden=false, visibility='public')을 뷰 안에 고정한다.
  -- 지터: hashtext 기반 개체별 결정적 오프셋, 위도 ±약460m / 경도 ±약470m(37°N 기준).
  execute format($f$
    create or replace view public.cats_public_map as
    select
      %s,
      lat + (((hashtext(id::text || '_lat') & 1023) - 512) * 0.0000081) as lat,
      lng + (((hashtext(id::text || '_lng') & 1023) - 512) * 0.0000101) as lng
    from public.cats
    where hidden = false and visibility = 'public'
  $f$, cols);
end $$;

grant select on public.cats_public_map to anon, authenticated;

-- ────────────────────────────────
-- STEP B. base 테이블 anon 잠금 — ⚠ 코드 배포(뷰 이관) 후에만 실행
-- ────────────────────────────────
-- do $$
-- declare
--   cols text;
-- begin
--   select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
--     into cols
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'cats'
--      and column_name not in ('lat', 'lng');
--
--   execute 'revoke select on public.cats from anon';
--   execute format('grant select (%s) on public.cats to anon', cols);
-- end $$;

-- ────────────────────────────────
-- 검증 (STEP B 후)
-- ────────────────────────────────
-- 1) anon으로 lat 직접 조회가 거부되는지 (42501 기대):
--    set local role anon; select lat from public.cats limit 1; reset role;
-- 2) anon으로 안전 컬럼은 되는지:
--    set local role anon; select id, name from public.cats limit 1; reset role;
-- 3) 뷰 좌표가 base와 다른지(지터 확인):
--    select c.id, c.lat as base_lat, v.lat as view_lat
--      from public.cats c join public.cats_public_map v using (id) limit 5;

-- ── 롤백 ──
-- drop view if exists public.cats_public_map;
-- revoke select on public.cats from anon;
-- grant select on public.cats to anon;  -- 전 컬럼 원복
