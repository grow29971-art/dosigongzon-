-- ══════════════════════════════════════════
-- 돌봄 일지 (care_logs) 테이블
-- 고양이별 구조화된 돌봄 기록 (밥/물/건강/병원 등)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.care_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id          UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name     TEXT,
  author_avatar_url TEXT,
  care_type       TEXT NOT NULL CHECK (care_type IN (
    'feed', 'water', 'health', 'tnr', 'hospital', 'shelter', 'other'
  )),
  memo            TEXT,
  photo_url       TEXT,
  amount          TEXT,
  logged_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 인덱스
CREATE INDEX IF NOT EXISTS care_logs_cat_logged_idx
  ON public.care_logs(cat_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS care_logs_author_idx
  ON public.care_logs(author_id, created_at DESC);

-- RLS
ALTER TABLE public.care_logs ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나
DROP POLICY IF EXISTS "care_logs_read" ON public.care_logs;
CREATE POLICY "care_logs_read" ON public.care_logs
  FOR SELECT USING (true);

-- 삽입: 인증 + 정지 안 된 유저
DROP POLICY IF EXISTS "care_logs_insert" ON public.care_logs;
CREATE POLICY "care_logs_insert" ON public.care_logs
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND public.is_user_not_suspended(auth.uid())
  );

-- 삭제: 본인
DROP POLICY IF EXISTS "care_logs_delete_own" ON public.care_logs;
CREATE POLICY "care_logs_delete_own" ON public.care_logs
  FOR DELETE USING (auth.uid() = author_id);

-- 삭제: 관리자
DROP POLICY IF EXISTS "care_logs_delete_admin" ON public.care_logs;
CREATE POLICY "care_logs_delete_admin" ON public.care_logs
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
-- 끝.
