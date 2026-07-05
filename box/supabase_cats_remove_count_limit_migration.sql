-- ══════════════════════════════════════════
-- cats INSERT 정책: 마릿수(하루 등록 개수) 제한 제거
-- 기존(4/17): 본인 인증 + 정지 아님 + 하루 3마리 이하
-- 변경: 본인 인증 + 정지 아님만 유지, 등록 개수 제한 없음
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

DROP POLICY IF EXISTS "cats_insert_authenticated" ON public.cats;

CREATE POLICY "cats_insert_authenticated"
  ON public.cats
  FOR INSERT
  WITH CHECK (
    auth.uid() = caretaker_id
    AND public.is_user_not_suspended(auth.uid())
  );

NOTIFY pgrst, 'reload schema';
-- 끝.
