-- ══════════════════════════════════════════
-- rescue_hospitals — 공공데이터 동기화용 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_rescue_hospitals_migration.sql
--       supabase_hospitals_latlng_migration.sql
-- ══════════════════════════════════════════

-- 데이터 출처 구분 (manual = 수동 추가, kakao = 카카오 공공데이터)
ALTER TABLE public.rescue_hospitals
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 카카오 장소 ID (중복 방지 + upsert 키)
ALTER TABLE public.rescue_hospitals
  ADD COLUMN IF NOT EXISTS kakao_place_id TEXT;

-- 카카오 장소 ID 유니크 인덱스 (NULL 제외)
CREATE UNIQUE INDEX IF NOT EXISTS rescue_hospitals_kakao_place_id_uniq
  ON public.rescue_hospitals(kakao_place_id)
  WHERE kakao_place_id IS NOT NULL;

-- source별 조회 인덱스
CREATE INDEX IF NOT EXISTS rescue_hospitals_source_idx
  ON public.rescue_hospitals(source);

NOTIFY pgrst, 'reload schema';
-- 끝.
