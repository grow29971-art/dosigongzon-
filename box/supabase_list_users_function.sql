-- ══════════════════════════════════════════
-- 관리자용 유저 목록 조회 함수
-- admin만 호출 가능 (SECURITY DEFINER로 auth.users 접근)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create or replace function public.list_all_users()
returns table (
  id uuid,
  email text,
  nickname text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_suspended boolean,
  suspended_reason text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    coalesce(
      (u.raw_user_meta_data->>'nickname')::text,
      (u.raw_user_meta_data->>'full_name')::text,
      (u.raw_user_meta_data->>'name')::text,
      split_part(u.email, '@', 1)
    ) as nickname,
    (u.raw_user_meta_data->>'avatar_url')::text,
    u.created_at,
    u.last_sign_in_at,
    exists (
      select 1 from public.user_suspensions s
      where s.user_id = u.id
        and (s.suspended_until is null or s.suspended_until > now())
    ) as is_suspended,
    (
      select s.reason from public.user_suspensions s
      where s.user_id = u.id
        and (s.suspended_until is null or s.suspended_until > now())
      limit 1
    ) as suspended_reason
  from auth.users u
  where exists (select 1 from public.admins where user_id = auth.uid())
  order by u.created_at desc;
$$;

grant execute on function public.list_all_users() to authenticated;

notify pgrst, 'reload schema';
-- 끝.
