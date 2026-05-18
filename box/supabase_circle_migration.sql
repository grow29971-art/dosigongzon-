-- ══════════════════════════════════════════
-- 도시공존 — Private Circle (믿는 이웃 서클)
-- 목적: 학대 우려 케어테이커의 핀을 "내가 승인한 이웃에게만" 노출.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_cats_schema.sql
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- STEP 1. cats 테이블에 visibility 컬럼 추가
-- ──────────────────────────────────────────
alter table public.cats
  add column if not exists visibility text not null default 'public';

alter table public.cats
  drop constraint if exists cats_visibility_check;
alter table public.cats
  add constraint cats_visibility_check
  check (visibility in ('public', 'private', 'circle'));

create index if not exists cats_visibility_idx
  on public.cats (visibility)
  where visibility <> 'public';

-- ──────────────────────────────────────────
-- STEP 2. 테이블 생성 (정책보다 먼저 — 상호 참조 때문)
-- ──────────────────────────────────────────

-- 2-1. 서클 테이블 (사용자당 1개 — owner 기준 unique)
create table if not exists public.caretaker_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '내 서클',
  created_at timestamptz default now() not null,
  unique(owner_id)
);

-- 2-2. 서클 멤버 테이블
create table if not exists public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.caretaker_circles(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  invited_at timestamptz default now() not null,
  accepted_at timestamptz,
  unique(circle_id, member_id)
);

create index if not exists circle_members_member_status_idx
  on public.circle_members (member_id, status);
create index if not exists circle_members_circle_idx
  on public.circle_members (circle_id);

-- ──────────────────────────────────────────
-- STEP 3. RLS 활성화
-- ──────────────────────────────────────────
alter table public.caretaker_circles enable row level security;
alter table public.circle_members enable row level security;

-- ──────────────────────────────────────────
-- STEP 4. caretaker_circles 정책
-- ──────────────────────────────────────────
drop policy if exists "circles_read_own_or_member" on public.caretaker_circles;
create policy "circles_read_own_or_member"
  on public.caretaker_circles
  for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.circle_members cm
      where cm.circle_id = caretaker_circles.id
        and cm.member_id = auth.uid()
        and cm.status = 'accepted'
    )
  );

drop policy if exists "circles_insert_own" on public.caretaker_circles;
create policy "circles_insert_own"
  on public.caretaker_circles
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "circles_update_own" on public.caretaker_circles;
create policy "circles_update_own"
  on public.caretaker_circles
  for update
  using (auth.uid() = owner_id);

drop policy if exists "circles_delete_own" on public.caretaker_circles;
create policy "circles_delete_own"
  on public.caretaker_circles
  for delete
  using (auth.uid() = owner_id);

-- ──────────────────────────────────────────
-- STEP 5. circle_members 정책
-- ──────────────────────────────────────────
drop policy if exists "circle_members_read" on public.circle_members;
create policy "circle_members_read"
  on public.circle_members
  for select
  using (
    auth.uid() = member_id
    or exists (
      select 1 from public.caretaker_circles cc
      where cc.id = circle_members.circle_id
        and cc.owner_id = auth.uid()
    )
  );

drop policy if exists "circle_members_invite" on public.circle_members;
create policy "circle_members_invite"
  on public.circle_members
  for insert
  with check (
    exists (
      select 1 from public.caretaker_circles cc
      where cc.id = circle_members.circle_id
        and cc.owner_id = auth.uid()
    )
  );

drop policy if exists "circle_members_update_self" on public.circle_members;
create policy "circle_members_update_self"
  on public.circle_members
  for update
  using (auth.uid() = member_id);

drop policy if exists "circle_members_delete" on public.circle_members;
create policy "circle_members_delete"
  on public.circle_members
  for delete
  using (
    auth.uid() = member_id
    or exists (
      select 1 from public.caretaker_circles cc
      where cc.id = circle_members.circle_id
        and cc.owner_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- STEP 6. cats SELECT 정책 — visibility 필터 (기존 정책 교체)
-- ──────────────────────────────────────────
drop policy if exists "cats_read_public" on public.cats;
drop policy if exists "cats_read_by_visibility" on public.cats;
create policy "cats_read_by_visibility"
  on public.cats
  for select
  using (
    visibility = 'public'
    or auth.uid() = caretaker_id
    or (
      visibility = 'circle'
      and exists (
        select 1
        from public.caretaker_circles cc
        join public.circle_members cm on cm.circle_id = cc.id
        where cc.owner_id = cats.caretaker_id
          and cm.member_id = auth.uid()
          and cm.status = 'accepted'
      )
    )
  );

-- ──────────────────────────────────────────
-- STEP 7. GRANT
-- ──────────────────────────────────────────
grant select, insert, update, delete on public.caretaker_circles to authenticated;
grant select, insert, update, delete on public.circle_members to authenticated;
