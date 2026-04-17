-- ══════════════════════════════════════════
-- cats 테이블 프로필 강화 컬럼 추가
-- 사진 여러장, 성별, 중성화 여부, 건강 상태
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 추가 사진 (배열, 기존 photo_url은 대표 사진으로 유지)
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';

-- 성별: male, female, unknown
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unknown'
  CHECK (gender IN ('male', 'female', 'unknown'));

-- 중성화 여부: true=완료, false=미완료, null=모름
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS neutered BOOLEAN;

-- 건강 상태: good, caution, danger
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'good'
  CHECK (health_status IN ('good', 'caution', 'danger'));

NOTIFY pgrst, 'reload schema';
-- 끝.
