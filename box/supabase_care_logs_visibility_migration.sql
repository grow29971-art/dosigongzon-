-- ══════════════════════════════════════════
-- 도시공존 — care_logs / cat_comments visibility 일관성 강화
-- 원인: care_logs·cat_comments SELECT 정책이 "누구나"라서 private/circle
--       cat의 기록도 비멤버에게 노출 가능 (cat 자체는 못 봐도 부속 데이터 누수).
-- 해결: 부속 테이블 SELECT를 cats RLS에 위임. EXISTS (SELECT 1 FROM cats WHERE id=cat_id)
--       — cats RLS가 visibility를 처리하므로 자동으로 일관성 보장.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_migration.sql + supabase_circle_recursion_fix.sql
-- ══════════════════════════════════════════

-- care_logs
drop policy if exists "care_logs_read" on public.care_logs;
create policy "care_logs_read"
  on public.care_logs
  for select
  using (
    exists (select 1 from public.cats c where c.id = care_logs.cat_id)
  );

-- cat_comments
drop policy if exists "cat_comments_read_public" on public.cat_comments;
drop policy if exists "cat_comments_read" on public.cat_comments;
create policy "cat_comments_read"
  on public.cat_comments
  for select
  using (
    exists (select 1 from public.cats c where c.id = cat_comments.cat_id)
  );

-- admin은 별도 정책으로 모든 행 조회 가능 — 기존 *_admin 정책 유지

notify pgrst, 'reload schema';
