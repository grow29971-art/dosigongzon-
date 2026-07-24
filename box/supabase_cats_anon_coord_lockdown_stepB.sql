-- ══════════════════════════════════════════
-- cats anon 좌표 잠금 — STEP B (실행용)
-- ⚠ 전제: STEP A(cats_public_map 뷰) 실행 완료 + 코드 배포 완료 (2026-07-24 심야 충족)
-- 효과: anon은 cats base 테이블에서 lat/lng를 읽을 수 없게 됨 (다른 컬럼은 그대로).
-- 본 파일은 supabase_cats_anon_coord_lockdown_migration.sql의 STEP B와 동일.
-- ══════════════════════════════════════════

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

  execute 'revoke select on public.cats from anon';
  execute format('grant select (%s) on public.cats to anon', cols);
end $$;

-- ────────────────────────────────
-- 검증 (같이 실행해도 됨 — 마지막 select 결과가 Editor에 표시됨)
-- ────────────────────────────────
-- 1) 뷰 좌표가 base와 다른지(지터):
select c.id, c.lat as base_lat, v.lat as view_lat
  from public.cats c join public.cats_public_map v using (id) limit 3;

-- 2) anon이 lat를 못 읽는지 (아래 두 줄을 별도로 실행 — "permission denied" 나오면 성공):
-- set local role anon; select lat from public.cats limit 1;

-- ── 롤백 ──
-- revoke select on public.cats from anon;
-- grant select on public.cats to anon;  -- 전 컬럼 원복
