-- ══════════════════════════════════════════════════════════════
-- 관리자 게시글·댓글 숨김/복원 RLS 정책 보장 (2026-08-29 법률감사 H1)
-- admin inbox가 게시글 신고를 처리(hidden 토글)하려면 admin UPDATE 정책이 필요.
-- posts_update_admin은 ALL_PENDING에 정의돼 있으나 실행 여부 불확실 → 여기서 멱등 재보장.
-- cat_comments·post_comments의 admin UPDATE(복원용) 정책도 함께 보장.
-- 실행: Supabase SQL Editor. 이미 있으면 drop→create로 안전 재적용.
-- ══════════════════════════════════════════════════════════════

-- posts: 관리자 숨김/복원(hidden 토글)
drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin" on public.posts for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- cat_comments: 관리자 복원(자동숨김 오신고 되돌리기)
drop policy if exists "cat_comments_update_admin" on public.cat_comments;
create policy "cat_comments_update_admin" on public.cat_comments for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- post_comments: 관리자 복원
drop policy if exists "post_comments_update_admin" on public.post_comments;
create policy "post_comments_update_admin" on public.post_comments for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 검증:
--   select tablename, policyname from pg_policies
--    where policyname in ('posts_update_admin','cat_comments_update_admin','post_comments_update_admin');
--   → 3행 나와야 정상

-- 롤백:
--   drop policy if exists "cat_comments_update_admin" on public.cat_comments;
--   drop policy if exists "post_comments_update_admin" on public.post_comments;
--   (posts_update_admin은 게시글 본인수정과 무관한 관리자 전용이라 유지 권장)
