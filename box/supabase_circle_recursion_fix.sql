-- ══════════════════════════════════════════
-- 도시공존 — Circle RLS 무한 재귀 핫픽스
-- 원인: caretaker_circles ↔ circle_members 정책이 서로 EXISTS로 참조 →
--       cats 정책에서 JOIN으로 호출 → 양쪽 정책이 무한 재귀.
-- 해결: security definer 함수로 RLS 우회 후 정책 단순화.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_migration.sql
-- ══════════════════════════════════════════

-- 1. 기존 재귀 정책 삭제
drop policy if exists "circles_read_own_or_member" on public.caretaker_circles;
drop policy if exists "circle_members_read" on public.circle_members;
drop policy if exists "circle_members_invite" on public.circle_members;
drop policy if exists "circle_members_delete" on public.circle_members;
drop policy if exists "cats_read_by_visibility" on public.cats;

-- 2. security definer 함수 — RLS 우회 헬퍼
-- 2-1. 내가 특정 owner의 서클 accepted 멤버인지
create or replace function public.is_circle_member_of(p_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.caretaker_circles cc
    join public.circle_members cm on cm.circle_id = cc.id
    where cc.owner_id = p_owner_id
      and cm.member_id = auth.uid()
      and cm.status = 'accepted'
  );
$$;

grant execute on function public.is_circle_member_of(uuid) to authenticated;

-- 2-2. 내가 특정 서클의 owner인지
create or replace function public.is_circle_owner_of(p_circle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.caretaker_circles cc
    where cc.id = p_circle_id
      and cc.owner_id = auth.uid()
  );
$$;

grant execute on function public.is_circle_owner_of(uuid) to authenticated;

-- 2-3. 내가 특정 서클의 멤버이거나 pending 초대 보유인지 (초대 받은 유저가 owner 정보 조회용)
create or replace function public.has_any_membership_of(p_circle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.member_id = auth.uid()
  );
$$;

grant execute on function public.has_any_membership_of(uuid) to authenticated;

-- 3. caretaker_circles 정책 (단순화 — owner 또는 멤버십 보유자만)
create policy "circles_read_own_or_member"
  on public.caretaker_circles
  for select
  using (
    auth.uid() = owner_id
    or public.has_any_membership_of(id)
  );

-- 4. circle_members 정책 — security definer 함수 사용해서 재귀 끊기
create policy "circle_members_read"
  on public.circle_members
  for select
  using (
    auth.uid() = member_id
    or public.is_circle_owner_of(circle_id)
  );

create policy "circle_members_invite"
  on public.circle_members
  for insert
  with check (public.is_circle_owner_of(circle_id));

create policy "circle_members_delete"
  on public.circle_members
  for delete
  using (
    auth.uid() = member_id
    or public.is_circle_owner_of(circle_id)
  );

-- 5. cats SELECT 정책 — security definer 함수로 circle 체크
create policy "cats_read_by_visibility"
  on public.cats
  for select
  using (
    visibility = 'public'
    or auth.uid() = caretaker_id
    or (
      visibility = 'circle'
      and public.is_circle_member_of(caretaker_id)
    )
  );
