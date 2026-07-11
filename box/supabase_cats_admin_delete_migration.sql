-- ══════════════════════════════════════════
-- 관리자 고양이 삭제/수정 권한 (2026-07-11)
-- 지도 UI의 관리자 수정/삭제 버튼은 이미 있으나 delete RLS 정책이 없어
-- 관리자 삭제가 조용히 실패(0 rows)했음. admins 테이블 기반으로 허용.
-- (update_admin 정책은 기존에 있지만 멱등하게 재생성)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

drop policy if exists "cats_update_admin" on public.cats;
create policy "cats_update_admin" on public.cats for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "cats_delete_admin" on public.cats;
create policy "cats_delete_admin" on public.cats for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';
-- 끝.
