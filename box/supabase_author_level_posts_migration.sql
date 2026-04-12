-- ══════════════════════════════════════════
-- posts, post_comments에 author_level 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.posts
  add column if not exists author_level int;

alter table public.post_comments
  add column if not exists author_level int;

notify pgrst, 'reload schema';
-- 끝.
