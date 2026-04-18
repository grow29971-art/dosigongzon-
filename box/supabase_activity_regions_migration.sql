-- ══════════════════════════════════════════
-- 활동 지역 (user_activity_regions) 테이블
-- 당근마켓 스타일: 유저당 최대 2개 활동 지역 (중심 좌표 + 반경)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_activity_regions (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot            SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  name            TEXT NOT NULL,           -- 예: "구월동", "남동구청 근처"
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  radius_m        INTEGER NOT NULL DEFAULT 1000 CHECK (radius_m BETWEEN 300 AND 5000),
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

-- 유저당 primary 는 한 개만
CREATE UNIQUE INDEX IF NOT EXISTS user_activity_regions_primary_idx
  ON public.user_activity_regions(user_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS user_activity_regions_user_idx
  ON public.user_activity_regions(user_id);

-- RLS
ALTER TABLE public.user_activity_regions ENABLE ROW LEVEL SECURITY;

-- 읽기: 본인만 (활동 지역은 개인 설정 — 타인에게 노출 안 함)
DROP POLICY IF EXISTS "user_activity_regions_read_own" ON public.user_activity_regions;
CREATE POLICY "user_activity_regions_read_own" ON public.user_activity_regions
  FOR SELECT USING (auth.uid() = user_id);

-- 삽입: 본인만 + 정지 안 된 유저
DROP POLICY IF EXISTS "user_activity_regions_insert_own" ON public.user_activity_regions;
CREATE POLICY "user_activity_regions_insert_own" ON public.user_activity_regions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_user_not_suspended(auth.uid())
  );

-- 수정: 본인만
DROP POLICY IF EXISTS "user_activity_regions_update_own" ON public.user_activity_regions;
CREATE POLICY "user_activity_regions_update_own" ON public.user_activity_regions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인만
DROP POLICY IF EXISTS "user_activity_regions_delete_own" ON public.user_activity_regions;
CREATE POLICY "user_activity_regions_delete_own" ON public.user_activity_regions
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.set_user_activity_regions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_activity_regions_updated_at ON public.user_activity_regions;
CREATE TRIGGER user_activity_regions_updated_at
  BEFORE UPDATE ON public.user_activity_regions
  FOR EACH ROW EXECUTE FUNCTION public.set_user_activity_regions_updated_at();

NOTIFY pgrst, 'reload schema';
-- 끝.
