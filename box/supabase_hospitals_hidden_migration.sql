-- ══════════════════════════════════════════
-- rescue_hospitals — 폐업 신고(숨김) 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

ALTER TABLE public.rescue_hospitals
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rescue_hospitals_hidden_idx
  ON public.rescue_hospitals(hidden);

NOTIFY pgrst, 'reload schema';
-- 끝.
