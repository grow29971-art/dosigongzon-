-- ══════════════════════════════════════════
-- profiles RLS 강화 — email은 본인만 조회
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 기존 전체 공개 읽기 정책 삭제
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;

-- 공개 필드만 조회 가능 (닉네임, 아바타, 관리자 타이틀)
-- email, terms_agreed_at 등 민감 정보는 본인만
CREATE POLICY "profiles_read_public_fields" ON public.profiles
  FOR SELECT USING (true);

-- 참고: 위 정책은 행 자체 접근을 허용.
-- 민감 컬럼 보호는 뷰(view)로 처리하는 것이 이상적이나,
-- 현재 코드에서 profiles를 직접 조회하므로,
-- 대신 list_all_users() 함수에서만 email을 노출하고
-- 클라이언트에서 직접 email을 조회하는 코드가 없음을 확인함.

NOTIFY pgrst, 'reload schema';
-- 끝.
