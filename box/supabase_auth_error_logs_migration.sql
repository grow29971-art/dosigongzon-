-- ══════════════════════════════════════════
-- 로그인 에러 로그 (auth_error_logs)
-- OAuth/비밀번호/매직링크 실패 원인 수집 → 패턴 분석 용도
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auth_error_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT,                              -- google | kakao | email | magic_link | oauth
  stage           TEXT NOT NULL DEFAULT 'unknown',   -- redirect | callback | client | signup
  error_code      TEXT,                              -- KOE205, redirect_uri_mismatch, access_denied 등
  error_desc      TEXT,                              -- error_description 원문
  user_agent      TEXT,
  url             TEXT,                              -- 에러 당시 URL (쿼리 포함)
  referrer        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 관리자 분석용 인덱스
CREATE INDEX IF NOT EXISTS auth_error_logs_created_idx
  ON public.auth_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS auth_error_logs_provider_idx
  ON public.auth_error_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_error_logs_code_idx
  ON public.auth_error_logs(error_code, created_at DESC);

-- RLS
ALTER TABLE public.auth_error_logs ENABLE ROW LEVEL SECURITY;

-- 삽입: 누구나 (비로그인 상태에서도 로깅 가능해야 함)
DROP POLICY IF EXISTS "auth_error_logs_insert_any" ON public.auth_error_logs;
CREATE POLICY "auth_error_logs_insert_any" ON public.auth_error_logs
  FOR INSERT WITH CHECK (true);

-- 읽기: 관리자만
DROP POLICY IF EXISTS "auth_error_logs_read_admin" ON public.auth_error_logs;
CREATE POLICY "auth_error_logs_read_admin" ON public.auth_error_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 삭제: 관리자만 (필요 시 오래된 로그 청소)
DROP POLICY IF EXISTS "auth_error_logs_delete_admin" ON public.auth_error_logs;
CREATE POLICY "auth_error_logs_delete_admin" ON public.auth_error_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
-- 끝.
