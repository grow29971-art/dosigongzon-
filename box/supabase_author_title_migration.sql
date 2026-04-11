-- ══════════════════════════════════════════
-- author_title 컬럼 추가 — 게시글/댓글 스냅샷
-- 작성 시점에 장착된 타이틀 id를 저장.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_posts_migration.sql, supabase_cat_comments_schema.sql, supabase_post_comments_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.posts
  add column if not exists author_title text;

alter table public.cat_comments
  add column if not exists author_title text;

alter table public.post_comments
  add column if not exists author_title text;

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';

-- 끝.
