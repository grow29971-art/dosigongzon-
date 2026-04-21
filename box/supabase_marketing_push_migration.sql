-- ══════════════════════════════════════════
-- 마케팅 푸시 수신 동의 (옵트인) 컬럼 추가
-- 정보통신망법 준수 — 광고성 푸시는 사전 동의 필요
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_push_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_marketing_push_idx
  ON public.profiles (marketing_push_enabled)
  WHERE marketing_push_enabled = true;

NOTIFY pgrst, 'reload schema';
-- 끝.
