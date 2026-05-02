-- ══════════════════════════════════════════
-- news 테이블에 자동수집(크롤링) 관련 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS source_url    text,
  ADD COLUMN IF NOT EXISTS source_name   text,
  ADD COLUMN IF NOT EXISTS auto_imported boolean DEFAULT false NOT NULL;

-- 동일한 외부 글 중복 삽입 방지 (NULL은 허용)
CREATE UNIQUE INDEX IF NOT EXISTS news_source_url_unique_idx
  ON public.news (source_url)
  WHERE source_url IS NOT NULL;

-- 자동수집 항목을 자주 가져오므로 인덱스 추가
CREATE INDEX IF NOT EXISTS news_auto_imported_created_idx
  ON public.news (auto_imported, created_at DESC);

NOTIFY pgrst, 'reload schema';
-- 끝.
