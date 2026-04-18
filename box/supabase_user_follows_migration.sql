-- ══════════════════════════════════════════
-- 캣맘 팔로우 (user_follows)
-- follower_id 가 following_id 를 팔로우
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_idx
  ON public.user_follows(follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_follows_following_idx
  ON public.user_follows(following_id, created_at DESC);

-- RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나 (팔로워·팔로잉 수 공개)
DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
CREATE POLICY "user_follows_read" ON public.user_follows
  FOR SELECT USING (true);

-- 삽입: 본인만 (auth.uid = follower_id) + 정지 안 된 유저
DROP POLICY IF EXISTS "user_follows_insert_own" ON public.user_follows;
CREATE POLICY "user_follows_insert_own" ON public.user_follows
  FOR INSERT WITH CHECK (
    auth.uid() = follower_id
    AND public.is_user_not_suspended(auth.uid())
  );

-- 삭제: 본인만 (언팔)
DROP POLICY IF EXISTS "user_follows_delete_own" ON public.user_follows;
CREATE POLICY "user_follows_delete_own" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);

NOTIFY pgrst, 'reload schema';
-- 끝.
