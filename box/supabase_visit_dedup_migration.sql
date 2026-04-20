-- ══════════════════════════════════════════
-- 방문자 카운트 인플레이션 방어
-- IP+date 기반 dedup 테이블. Vercel 멀티 인스턴스 환경에서도 원자적 차단.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anon_visit_dedupe (
  ip_hash TEXT NOT NULL,
  visit_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, visit_date)
);

CREATE INDEX IF NOT EXISTS anon_visit_dedupe_date_idx
  ON public.anon_visit_dedupe (visit_date);

-- RLS — 공개 접근 막음 (service_role만 사용)
ALTER TABLE public.anon_visit_dedupe ENABLE ROW LEVEL SECURITY;

-- 오래된 레코드 자동 정리 (30일 초과)
-- 선택사항: pg_cron이나 Vercel Cron에서 주기적 DELETE

-- 정리용 함수
CREATE OR REPLACE FUNCTION public.cleanup_old_visit_dedupe()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
AS $$
  DELETE FROM public.anon_visit_dedupe
  WHERE visit_date < (CURRENT_DATE - INTERVAL '30 days');
$$;

NOTIFY pgrst, 'reload schema';
-- 끝.
