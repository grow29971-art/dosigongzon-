-- ══════════════════════════════════════════
-- cat_comments에 작성자 아바타 URL 스냅샷 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

alter table public.cat_comments
  add column if not exists author_avatar_url text;

-- 끝.
