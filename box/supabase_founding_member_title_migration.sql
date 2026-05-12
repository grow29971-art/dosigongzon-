-- ══════════════════════════════════════════════════════════════
-- 창립 멤버 타이틀 부여 — 145명 활성화 작업
-- 작성: 2026-05-12
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent)
-- ⚠ Chrome 번역 OFF
--
-- 목적:
-- 정식 오픈(2026-05-20 00:00 KST) 전에 가입한 모든 사용자에게
-- "창립 멤버" 영구 타이틀 부여. 자부심·소속감으로 이탈 방지 + 입소문.
--
-- 동작:
-- 1) 기존 가입자(현재 145명) 일괄 update — admin_title이 NULL인 사람에만
-- 2) 5/13~5/19 신규 가입자에 BEFORE INSERT trigger로 자동 부여
-- 3) 5/20 00:00 KST 이후 가입자는 자동 부여 안 됨 (trigger의 날짜 체크)
--
-- 5/20 이후엔 이 trigger를 drop해도 되고 그대로 둬도 (조건 안 맞아 발동 안 함).
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- PART 1. 기존 가입자에 일괄 부여
-- ══════════════════════════════════════════════════════════════
-- admin_title이 이미 다른 값이면 덮어쓰지 않음 (admin이 미리 다른 타이틀 부여한 경우 존중)
-- 정식 오픈 시각: 2026-05-20 00:00 KST = 2026-05-19 15:00:00 UTC
--
-- ⚠ profiles 테이블엔 BEFORE UPDATE trg_guard_profile_sensitive 트리거가 있어
--   admin_title 변경을 일반 사용자에겐 막음. SQL Editor는 postgres 슈퍼유저로 실행되므로
--   auth.role() != 'service_role' 판정으로 차단됨. set local role로 service_role
--   권한으로 transaction 안에서만 변경.

begin;
set local role service_role;

update public.profiles
set admin_title = 'founding_member'
where created_at < '2026-05-19 15:00:00+00:00'::timestamptz
  and admin_title is null;

commit;

-- 적용 건수 확인 (info)
-- select count(*) as founding_members from public.profiles where admin_title = 'founding_member';


-- ══════════════════════════════════════════════════════════════
-- PART 2. 5/13~5/19 신규 가입자 자동 부여 trigger
-- ══════════════════════════════════════════════════════════════
-- profiles INSERT 시 admin_title이 비어있으면 자동으로 founding_member 부여 (5/20 전까지만)

create or replace function public.assign_founding_member_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 이미 admin_title이 있으면 덮어쓰지 않음
  if new.admin_title is not null then
    return new;
  end if;

  -- 정식 오픈 (2026-05-20 00:00 KST = 2026-05-19 15:00 UTC) 전 가입자만
  if new.created_at < '2026-05-19 15:00:00+00:00'::timestamptz then
    new.admin_title := 'founding_member';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_assign_founding_member on public.profiles;
create trigger tr_assign_founding_member
  before insert on public.profiles
  for each row execute function public.assign_founding_member_title();


-- ══════════════════════════════════════════════════════════════
-- 적용 확인 쿼리
-- ══════════════════════════════════════════════════════════════
-- 1) 부여된 인원 수:
-- select count(*) from public.profiles where admin_title = 'founding_member';
--
-- 2) 가장 최근 부여된 5명:
-- select nickname, created_at, admin_title from public.profiles
-- where admin_title = 'founding_member'
-- order by created_at desc limit 5;
--
-- 3) trigger 등록 확인:
-- select trigger_name from information_schema.triggers
-- where event_object_table = 'profiles' and trigger_name = 'tr_assign_founding_member';
-- ══════════════════════════════════════════════════════════════
