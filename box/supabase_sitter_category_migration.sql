-- ══════════════════════════════════════════════════════════════
-- 돌봄 부탁(sitter) 카테고리 추가 — 입원·여행 시 밥자리 대타 요청
-- 2026-08-29 PMF 개편: 캣맘이 실제로 돈을 쓰는 유일한 pain(부재 시 대타)의 최소 구현
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('emergency','sitter','foster','adoption','market','free'));

-- 검증:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.posts'::regclass and conname = 'posts_category_check';

-- ── 롤백 ──
-- (sitter 글이 이미 있으면 먼저 카테고리를 옮기거나 삭제해야 제약이 붙는다)
-- update public.posts set category = 'free' where category = 'sitter';
-- alter table public.posts drop constraint if exists posts_category_check;
-- alter table public.posts add constraint posts_category_check
--   check (category in ('emergency','foster','adoption','market','free'));
