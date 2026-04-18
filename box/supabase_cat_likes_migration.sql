-- ══════════════════════════════════════════
-- 고양이 좋아요 (cat_likes) 테이블
-- 유저가 고양이에게 하트를 누를 수 있음. 유저당 고양이 1회.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 1) cats 테이블에 like_count 컬럼 추가 (비정규화, 트리거로 유지)
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS cats_like_count_idx
  ON public.cats(like_count DESC);

-- 2) cat_likes 테이블
CREATE TABLE IF NOT EXISTS public.cat_likes (
  cat_id     UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cat_id, user_id)
);

CREATE INDEX IF NOT EXISTS cat_likes_user_idx
  ON public.cat_likes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cat_likes_cat_idx
  ON public.cat_likes(cat_id);

-- 3) RLS
ALTER TABLE public.cat_likes ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나 (카운트/내 좋아요 조회용)
DROP POLICY IF EXISTS "cat_likes_read" ON public.cat_likes;
CREATE POLICY "cat_likes_read" ON public.cat_likes
  FOR SELECT USING (true);

-- 삽입: 본인만 + 정지 안 된 유저
DROP POLICY IF EXISTS "cat_likes_insert_own" ON public.cat_likes;
CREATE POLICY "cat_likes_insert_own" ON public.cat_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_user_not_suspended(auth.uid())
  );

-- 삭제: 본인만
DROP POLICY IF EXISTS "cat_likes_delete_own" ON public.cat_likes;
CREATE POLICY "cat_likes_delete_own" ON public.cat_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 4) 트리거: cat_likes INSERT/DELETE 시 cats.like_count 자동 갱신
CREATE OR REPLACE FUNCTION public.sync_cat_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cats SET like_count = like_count + 1 WHERE id = NEW.cat_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.cats SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.cat_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cat_likes_sync_count ON public.cat_likes;
CREATE TRIGGER cat_likes_sync_count
  AFTER INSERT OR DELETE ON public.cat_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_cat_like_count();

-- 5) 기존 레거시 복구 — 이미 데이터가 있으면 카운트 재계산
UPDATE public.cats c
SET like_count = COALESCE((SELECT COUNT(*) FROM public.cat_likes l WHERE l.cat_id = c.id), 0);

NOTIFY pgrst, 'reload schema';
-- 끝.
