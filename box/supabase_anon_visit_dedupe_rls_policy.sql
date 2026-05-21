-- ══════════════════════════════════════════
-- 도시공존 — anon_visit_dedupe RLS 정책 명시화
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
-- 선행조건: supabase_visit_dedup_migration.sql
-- 목적: Supabase Linter 경고 해소
--      "RLS enabled, no policy" — 의도된 deny-all을 명시
--      service_role만 접근하는 dedupe 테이블이라 anon/authenticated는 완전 차단이 정상.
-- ══════════════════════════════════════════

-- 안전성: service_role은 RLS bypass라 본 정책 영향 없음. visit API 정상 동작 유지.

-- 1) 명시적 deny-all 정책 — anon, authenticated 모든 작업 차단
--    USING/WITH CHECK 둘 다 false 라 SELECT/INSERT/UPDATE/DELETE 전부 막힘
drop policy if exists "anon_visit_dedupe_deny_all" on public.anon_visit_dedupe;
create policy "anon_visit_dedupe_deny_all"
  on public.anon_visit_dedupe
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- 2) 이중 방어 — anon/authenticated 권한 회수
--    RLS 정책과 별개로 GRANT 자체를 제거. service_role만 작업 가능.
revoke all on public.anon_visit_dedupe from anon, authenticated;

-- PostgREST 스키마 캐시 리로드
notify pgrst, 'reload schema';

-- 끝.
-- 검증:
--   select * from pg_policies where tablename = 'anon_visit_dedupe';
--   → "anon_visit_dedupe_deny_all" 1행이 나오면 OK
