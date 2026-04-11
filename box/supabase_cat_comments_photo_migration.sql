-- ══════════════════════════════════════════
-- cat_comments에 사진 첨부 기능 추가 (마이그레이션)
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행 조건: supabase_cat_comments_schema.sql 이 실행되어 있어야 함
-- ══════════════════════════════════════════

-- 1. photo_url 컬럼 추가 (nullable)
alter table public.cat_comments
  add column if not exists photo_url text;

-- 2. 기존 Storage 정책은 cat-photos 버킷 전체를 커버하므로 그대로 재사용.
--    (cat_photos_insert_authenticated / cat_photos_read_public / cat_photos_delete_own)

-- 3. 더미 데이터 일부에 테스트용 플레이스홀더 사진 주입 (선택)
update public.cat_comments
set photo_url = 'https://placehold.co/600x600/EEE8E0/C47E5A?text=%EB%8F%8C%EB%B4%84%EA%B8%B0%EB%A1%9D'
where kind = 'note'
  and body like '%츄르%';

-- 끝.
