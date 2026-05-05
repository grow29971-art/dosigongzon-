-- ══════════════════════════════════════════
-- 관리자 추가 — rias21125@gmail.com
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
--
-- 선행조건: rias21125@gmail.com 계정이 이미 사이트에 회원가입 되어있어야 함
--          (auth.users 테이블에 row가 있어야 user_id 조회 가능)
--
-- 등록 못 된 상태라면: 먼저 그 이메일로 https://dosigongzon.com/signup 가입 → 이 SQL 재실행
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 대상 유저가 auth.users에 있는지 확인 (없으면 NOTICE)
-- ──────────────────────────────────────────
do $$
declare
  v_user_id uuid;
  v_email   text := 'rias21125@gmail.com';
begin
  select id into v_user_id
    from auth.users
    where email = v_email
    limit 1;

  if v_user_id is null then
    raise exception '❌ % 계정이 auth.users에 없습니다. 먼저 그 이메일로 사이트 회원가입을 해주세요.', v_email;
  end if;

  -- 이미 admin이면 스킵, 아니면 추가 (idempotent)
  insert into public.admins (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

  raise notice '✅ % (user_id=%) 가 admin으로 등록되었습니다.', v_email, v_user_id;
end $$;

-- ──────────────────────────────────────────
-- 2. 등록 결과 확인 (이메일 + user_id + 등록일시)
-- ──────────────────────────────────────────
select
  u.email,
  a.user_id,
  a.created_at as admin_since
from public.admins a
  join auth.users u on u.id = a.user_id
order by a.created_at desc;

-- 끝.
