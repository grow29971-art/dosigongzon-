-- ══════════════════════════════════════════
-- profiles 민감 컬럼 guard 트리거 fix
-- 문제: service_role 키로 /api/admin/set-title 호출 시 auth.uid()가 NULL
--       → is_admin = false → admin_title 변경 차단됨
-- 해결: service_role 호출은 명시적으로 통과시킴
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- service_role 호출은 통과 (/api/admin/set-title 등 서버 라우트가
  -- 이미 admin 검증 후 service_role로 직접 update하는 경로).
  -- id 변경만 공통으로 차단.
  IF auth.role() = 'service_role' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'id는 변경할 수 없습니다.';
    END IF;
    RETURN NEW;
  END IF;

  -- 일반 유저 경로 — 기존 검증 유지
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    INTO v_is_admin;

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

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'id는 변경할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
-- 끝.
