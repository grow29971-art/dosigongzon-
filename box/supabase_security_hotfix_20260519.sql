-- ══════════════════════════════════════════
-- 도시공존 — 자체 보안 감사 핫픽스 (2026-05-19)
-- 발견된 4개 즉시 패치:
--  1. profiles.email 전체 노출 (anon dump 가능)
--  2. profiles.suspended 본인 self-해제 가능
--  3. cats SELECT 정책 공존 확인·정리 (visibility 우회 위험)
--  4. (별도 코드 변경: hospital 신고 5건 즉시 숨김 — SQL 외 처리)
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- FIX 1. profiles.email 노출 차단
-- 정책 분리: 공개 필드(닉네임·아바타·관리 타이틀)는 모두에게,
-- 민감 필드(email, suspended 등)는 본인만 SELECT.
-- 가장 안전한 방법: SELECT 정책을 "본인 row 전체" + "타인 row의 비민감 컬럼만" 분리.
-- PostgreSQL은 컬럼 단위 RLS 직접 지원 X → view 또는 컬럼 REVOKE로 처리.
--
-- 접근: SELECT 정책은 그대로 두되 anon/authenticated에 대해 email 컬럼 SELECT 권한 REVOKE.
-- 본인 email만 보려면 별도 RPC 또는 auth.users.email 사용 (Supabase Auth 자체 제공).
-- ──────────────────────────────────────────

revoke select (email) on public.profiles from anon, authenticated;

-- 본인은 본인 row 통째로 보고 싶을 수 있으므로 본인용 RPC 제공 (선택)
create or replace function public.my_profile_email()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email from public.profiles where id = auth.uid() limit 1;
$$;

grant execute on function public.my_profile_email() to authenticated;

-- ──────────────────────────────────────────
-- FIX 2. profiles.suspended 본인 self-해제 차단
-- 기존 guard 트리거가 admin_title/invite_code/invited_by/id만 보호.
-- suspended 누락 → 정지 유저가 update로 false 설정 가능.
-- 트리거 함수 교체 (이름·로직 보존, suspended 추가).
-- ──────────────────────────────────────────

create or replace function public.profiles_guard_protected_fields()
returns trigger
language plpgsql
as $$
begin
  -- admin이 update하는 경우는 통과 (관리 작업)
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    return new;
  end if;

  -- 일반 유저는 보호 필드 변경 차단
  if new.admin_title is distinct from old.admin_title then
    raise exception '권한 없음: admin_title 변경 불가';
  end if;
  if new.invite_code is distinct from old.invite_code then
    raise exception '권한 없음: invite_code 변경 불가';
  end if;
  if new.invited_by is distinct from old.invited_by then
    raise exception '권한 없음: invited_by 변경 불가';
  end if;
  if new.id is distinct from old.id then
    raise exception '권한 없음: id 변경 불가';
  end if;
  -- ★ 신규: suspended 자가 해제 차단
  if new.suspended is distinct from old.suspended then
    raise exception '권한 없음: suspended 변경 불가 (admin 전용)';
  end if;

  return new;
end;
$$;

-- 트리거 자체 재바인딩 (기존이 있으면 그대로 사용)
drop trigger if exists profiles_guard_protected_fields_trg on public.profiles;
create trigger profiles_guard_protected_fields_trg
  before update on public.profiles
  for each row
  execute function public.profiles_guard_protected_fields();

-- ──────────────────────────────────────────
-- FIX 3. cats SELECT 정책 공존 확인·정리
-- auto_hide_reported_migration.sql이 cats_read_public을 만들었고,
-- circle_migration.sql이 cats_read_by_visibility로 교체했으나,
-- 이후 visibility_hidden_fix.sql에서 cats_read_public을 drop 안 함.
-- 두 정책 동시 활성 시 RLS는 OR 결합 → private/circle 노출.
-- 강제 drop으로 일관성 확보.
-- ──────────────────────────────────────────

drop policy if exists "cats_read_public" on public.cats;
-- cats_read_by_visibility만 살아있게 (visibility_hidden_fix가 적용 안 됐다면 재생성)
drop policy if exists "cats_read_by_visibility" on public.cats;
create policy "cats_read_by_visibility"
  on public.cats
  for select
  using (
    hidden = false
    and (
      visibility = 'public'
      or auth.uid() = caretaker_id
      or (
        visibility = 'circle'
        and public.is_circle_member_of(caretaker_id)
      )
    )
  );

-- 본인 핀은 hidden 상태여도 본인은 볼 수 있게
drop policy if exists "cats_read_own_even_hidden" on public.cats;
create policy "cats_read_own_even_hidden"
  on public.cats
  for select
  using (auth.uid() = caretaker_id);

-- admin 정책은 별도 cats_read_admin이 auto_hide_reported_migration에서 이미 생성됨 (영향 없음)

notify pgrst, 'reload schema';
