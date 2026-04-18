-- ══════════════════════════════════════════
-- list_all_users() — provider(로그인 방식) 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
-- 반환 타입이 바뀌었으므로 DROP 후 재생성 (CREATE OR REPLACE 불가)
-- ══════════════════════════════════════════

DROP FUNCTION IF EXISTS public.list_all_users();

CREATE FUNCTION public.list_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_suspended BOOLEAN,
  suspended_reason TEXT,
  admin_title TEXT,
  provider TEXT,
  providers TEXT[]
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(
      (u.raw_user_meta_data->>'nickname')::text,
      (u.raw_user_meta_data->>'full_name')::text,
      (u.raw_user_meta_data->>'name')::text,
      split_part(u.email, '@', 1)
    ) AS nickname,
    (u.raw_user_meta_data->>'avatar_url')::text AS avatar_url,
    u.created_at,
    u.last_sign_in_at,
    EXISTS (
      SELECT 1 FROM public.user_suspensions s
      WHERE s.user_id = u.id
        AND (s.suspended_until IS NULL OR s.suspended_until > now())
    ) AS is_suspended,
    (
      SELECT s.reason FROM public.user_suspensions s
      WHERE s.user_id = u.id
        AND (s.suspended_until IS NULL OR s.suspended_until > now())
      LIMIT 1
    ) AS suspended_reason,
    (SELECT p.admin_title FROM public.profiles p WHERE p.id = u.id) AS admin_title,
    -- 주 로그인 provider (첫 번째 가입 방식)
    (u.raw_app_meta_data->>'provider')::text AS provider,
    -- 연결된 모든 provider 목록 (여러 개 연결된 경우)
    CASE
      WHEN jsonb_typeof(u.raw_app_meta_data->'providers') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(u.raw_app_meta_data->'providers'))
      ELSE NULL
    END AS providers
  FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  ORDER BY u.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;

NOTIFY pgrst, 'reload schema';
-- 끝.
