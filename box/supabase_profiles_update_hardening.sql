-- ══════════════════════════════════════════
-- profiles UPDATE 정책 강화 (권한 상승 방지)
-- 원인: 기존 profiles_update_own 에 WITH CHECK 가 없어서
--       유저가 admin_title 등 민감 컬럼을 직접 변경 가능
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 1. 기본 update 정책 — WITH CHECK 추가로 id 위조 차단
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. 민감 컬럼 변경 차단 트리거 (admin만 변경 가능한 필드 보호)
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- admin 여부
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    INTO v_is_admin;

  -- admin 이 아니면 민감 컬럼 변경 차단
  IF NOT v_is_admin THEN
    IF NEW.admin_title IS DISTINCT FROM OLD.admin_title THEN
      RAISE EXCEPTION 'admin_title은 관리자만 변경 가능합니다.';
    END IF;
    IF NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN
      RAISE EXCEPTION 'invite_code는 시스템이 발급합니다.';
    END IF;
    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
      RAISE EXCEPTION 'invited_by는 초대 코드 RPC로만 설정됩니다.';
    END IF;
  END IF;

  -- id 변경은 누구도 불가
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id는 변경할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

NOTIFY pgrst, 'reload schema';
-- 끝.
