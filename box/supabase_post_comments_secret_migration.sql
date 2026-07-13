-- ══════════════════════════════════════════
-- 커뮤니티 비밀 댓글 (2026-07-13) — 네이버 블로그식
-- is_secret=true 댓글은 [댓글 작성자 + 게시글 작성자 + 관리자]에게만 보임.
-- ⚠ 핵심: RLS SELECT 정책으로 강제 (권한 없는 사람에겐 행 자체가 안 내려감).
-- post_comments.post_id는 text, posts.id는 uuid → p.id::text 로 조인.
-- (seed-* 등 로컬 게시글은 posts에 없어 게시글작성자 매칭 불가 → 댓글작성자·관리자만)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.post_comments
  add column if not exists is_secret boolean not null default false;

drop policy if exists "post_comments_read_public" on public.post_comments;
drop policy if exists "post_comments_read" on public.post_comments;
create policy "post_comments_read" on public.post_comments
  for select using (
    is_secret = false
    or auth.uid() = author_id
    or exists (
      select 1 from public.posts p
      where p.id::text = post_comments.post_id
        and p.author_id = auth.uid()
    )
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

-- ── 롤백 ──
-- drop policy if exists "post_comments_read" on public.post_comments;
-- create policy "post_comments_read_public" on public.post_comments for select using (true);
-- alter table public.post_comments drop column if exists is_secret;
