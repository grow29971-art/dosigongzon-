-- ══════════════════════════════════════════
-- 관리자 등록 진단 + 강제 재등록
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

-- ① 내 auth.users에 계정이 있는지 확인
select id, email, created_at
from auth.users
where lower(email) = lower('grow29971@gmail.com');

-- ② public.admins에 이미 등록되어 있는지 확인
select a.user_id, u.email, a.created_at
from public.admins a
join auth.users u on a.user_id = u.id
where lower(u.email) = lower('grow29971@gmail.com');

-- ③ (없다면) 강제 등록 — 이메일 대소문자 무시
insert into public.admins (user_id)
  select id from auth.users
  where lower(email) = lower('grow29971@gmail.com')
  on conflict (user_id) do nothing;

-- ④ 다시 확인
select a.user_id, u.email, a.created_at
from public.admins a
join auth.users u on a.user_id = u.id
where lower(u.email) = lower('grow29971@gmail.com');

-- ⑤ 스키마 캐시 재로드
notify pgrst, 'reload schema';
