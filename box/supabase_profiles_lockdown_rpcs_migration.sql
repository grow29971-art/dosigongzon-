-- ══════════════════════════════════════════
-- profiles 락다운 전제 RPC 2종 (2026-07-24)
-- base RLS를 self+admin으로 잠그기 전에, 앱이 교차유저로 읽던 두 경로를
-- SECURITY DEFINER 함수로 안전하게 대체한다.
--   ① get_inviter_code()  — 나를 초대한 사람의 invite_code (본인 invited_by만 따라감)
--   ② total_user_count()  — 공개 가입자 수 (홈/이벤트 배너 카운트, anon 포함)
-- ⚠ 이 파일은 "추가만" 하므로 지금 실행해도 아무것도 깨지지 않는다.
--   반드시 앱 코드 repoint 배포 '이전'에 실행해야 코드가 이 함수를 찾는다.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- ① 나를 초대한 사람의 invite_code
--    invite_code REVOKE/락다운 후에도 "나를 초대한 사람 코드"를 안전히 반환.
--    인자 없음 — 오직 auth.uid()의 invited_by만 따라가므로 남의 코드 임의조회 불가.
create or replace function public.get_inviter_code()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select inviter.invite_code
  from public.profiles me
  join public.profiles inviter on inviter.id = me.invited_by
  where me.id = auth.uid();
$$;

revoke all on function public.get_inviter_code() from public, anon;
grant execute on function public.get_inviter_code() to authenticated;

-- ② 공개 가입자 수
--    self+admin 락다운 시 anon/authenticated의 count(*)가 0이 되는 것을 대체.
--    민감정보 아님(가입자 총수는 공개 지표) — anon도 실행 허용.
create or replace function public.total_user_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.profiles;
$$;

revoke all on function public.total_user_count() from public;
grant execute on function public.total_user_count() to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   select public.total_user_count();            → 정수(현재 가입자 수)
--   (로그인 유저 컨텍스트) select public.get_inviter_code();  → 코드 또는 null

-- ── ROLLBACK ──
-- drop function if exists public.get_inviter_code();
-- drop function if exists public.total_user_count();
