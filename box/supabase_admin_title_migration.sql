-- ══════════════════════════════════════════
-- profiles — 관리자 부여 특별 타이틀 컬럼
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_title TEXT;

COMMENT ON COLUMN public.profiles.admin_title IS '관리자가 부여한 특별 타이틀 ID';

-- list_all_users() 함수에 admin_title 추가
CREATE OR REPLACE FUNCTION public.list_all_users()
RETURNS TABLE (
  id UUID, email TEXT, nickname TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ,
  is_suspended BOOLEAN, suspended_reason TEXT, admin_title TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT
    u.id, u.email::text,
    coalesce((u.raw_user_meta_data->>'nickname')::text,(u.raw_user_meta_data->>'full_name')::text,(u.raw_user_meta_data->>'name')::text,split_part(u.email,'@',1)) as nickname,
    (u.raw_user_meta_data->>'avatar_url')::text,
    u.created_at, u.last_sign_in_at,
    exists (select 1 from public.user_suspensions s where s.user_id = u.id and (s.suspended_until is null or s.suspended_until > now())) as is_suspended,
    (select s.reason from public.user_suspensions s where s.user_id = u.id and (s.suspended_until is null or s.suspended_until > now()) limit 1) as suspended_reason,
    (select p.admin_title from public.profiles p where p.id = u.id) as admin_title
  FROM auth.users u
  WHERE exists (select 1 from public.admins where user_id = auth.uid())
  ORDER BY u.created_at desc;
$$;

GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;

NOTIFY pgrst, 'reload schema';
-- 끝.
