-- ══════════════════════════════════════════
-- 댓글·포스트 이모지 리액션 (반응 버튼)
-- 기존 like/dislike와 별개로, 감성 표현용 4종 (heart/sad/fire/thanks)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('cat_comment', 'post_comment')),
  target_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (emoji IN ('heart', 'sad', 'fire', 'thanks')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS reactions_target_idx
  ON public.reactions (target_type, target_id);

CREATE INDEX IF NOT EXISTS reactions_user_idx
  ON public.reactions (user_id);

-- RLS
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나 (공개 카운트)
DROP POLICY IF EXISTS "reactions_read" ON public.reactions;
CREATE POLICY "reactions_read" ON public.reactions
  FOR SELECT USING (true);

-- 삽입: 본인만 + 정지 안 된 유저
DROP POLICY IF EXISTS "reactions_insert_own" ON public.reactions;
CREATE POLICY "reactions_insert_own" ON public.reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.is_user_not_suspended(auth.uid())
  );

-- 삭제: 본인만 (언리액션)
DROP POLICY IF EXISTS "reactions_delete_own" ON public.reactions;
CREATE POLICY "reactions_delete_own" ON public.reactions
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
-- 끝.
