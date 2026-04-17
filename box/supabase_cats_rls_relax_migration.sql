-- ══════════════════════════════════════════
-- cats INSERT 정책 완화
-- 가입 후 24시간 대기 제거, 하루 3마리로 완화
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 기존 정책 삭제
DROP POLICY IF EXISTS "cats_insert_authenticated" ON public.cats;

-- 새 정책: 본인 인증 + 정지 아님 + 하루 3마리 이하
CREATE POLICY "cats_insert_authenticated"
  ON public.cats
  FOR INSERT
  WITH CHECK (
    auth.uid() = caretaker_id
    AND public.is_user_not_suspended(auth.uid())
    AND public.user_cats_created_within(auth.uid(), 60 * 24) < 3
  );

NOTIFY pgrst, 'reload schema';
-- 끝.
