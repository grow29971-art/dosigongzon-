-- ══════════════════════════════════════════
-- 도시공존 — 집회 참여하기 버튼 (2026-08-08 보신각 집회)
-- 목적: 홈 집회 포스터 아래 "참여하기" 버튼 → 참여 의사 인원 추산.
--   - 일반 유저: 1인 1회 (partial unique index로 강제)
--   - 관리자(admins 등재자): 중복 클릭 허용 (admin_extra=true 행으로 무제한)
--   - 카운트는 RPC로 전체 공개 (개별 row는 본인 것만 조회 가능)
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: admins 테이블, is_user_not_suspended() 함수
-- ══════════════════════════════════════════

create table if not exists public.rally_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 관리자 부스트 행: 일반 유저는 항상 false, true는 admins 등재자만 (RLS로 강제)
  admin_extra boolean not null default false,
  created_at timestamptz not null default now()
);

-- 일반 참여는 유저당 1회 — admin_extra=true 행은 제한 없음
create unique index if not exists rally_participations_one_per_user
  on public.rally_participations (user_id)
  where admin_extra = false;

alter table public.rally_participations enable row level security;

-- INSERT: 본인 행만 + 정지 유저 차단 + admin_extra=true는 관리자만
drop policy if exists "rally_insert_own" on public.rally_participations;
create policy "rally_insert_own"
  on public.rally_participations for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_user_not_suspended(auth.uid())
    and (
      admin_extra = false
      or exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
  );

-- SELECT: 본인 행만 (참여 여부 확인용) — 전체 명단은 비공개
drop policy if exists "rally_select_own" on public.rally_participations;
create policy "rally_select_own"
  on public.rally_participations for select to authenticated
  using (user_id = auth.uid());

-- UPDATE/DELETE 정책 없음 = 불가 (참여 취소 기능 없음)

-- 카운트 RPC — 익명 포함 모두에게 총 참여 수만 노출
create or replace function public.rally_participation_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint from public.rally_participations;
$$;

grant execute on function public.rally_participation_count() to anon, authenticated;

-- ══════════════════════════════════════════
-- 롤백 (집회 종료 후 정리 시)
-- drop function if exists public.rally_participation_count();
-- drop table if exists public.rally_participations;
-- ══════════════════════════════════════════
