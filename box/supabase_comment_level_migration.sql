-- ══════════════════════════════════════════
-- cat_comments에 작성자 레벨 스냅샷 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

alter table public.cat_comments
  add column if not exists author_level smallint;

-- 스키마 캐시 강제 재로드
notify pgrst, 'reload schema';

-- 끝.
