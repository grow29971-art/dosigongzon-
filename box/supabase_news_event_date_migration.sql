-- ══════════════════════════════════════════
-- news 테이블에 event_date 컬럼 추가 (자동 D-Day 계산용)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS event_date DATE;

-- 기존 dday TEXT 필드는 유지 (event_date 없는 소식의 폴백용)

NOTIFY pgrst, 'reload schema';
-- 끝.
