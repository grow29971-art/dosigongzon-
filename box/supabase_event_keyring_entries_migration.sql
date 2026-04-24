-- ══════════════════════════════════════════
-- 1000명 이벤트 — 키링 응모 (2026-04-25)
-- 응모자 이름·주소·전화·고양이 사진 저장.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

create table if not exists public.event_keyring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  address text not null,
  phone text not null,
  cat_photo_url text not null,
  -- 추첨/배송 상태 (admin 전용)
  status text not null default 'pending'
    check (status in ('pending', 'selected', 'shipped', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 유저가 여러 번 응모 못 하게
create unique index if not exists event_keyring_entries_user_uidx
  on public.event_keyring_entries (user_id);

-- 관리자 정렬·필터용
create index if not exists event_keyring_entries_status_created_idx
  on public.event_keyring_entries (status, created_at desc);

alter table public.event_keyring_entries enable row level security;

-- SELECT: 본인 응모 + admin은 전체
drop policy if exists event_keyring_entries_select_own on public.event_keyring_entries;
create policy event_keyring_entries_select_own
  on public.event_keyring_entries
  for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

-- INSERT: 본인 이름으로만, 정지 유저 차단
drop policy if exists event_keyring_entries_insert_own on public.event_keyring_entries;
create policy event_keyring_entries_insert_own
  on public.event_keyring_entries
  for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.user_suspensions s
      where s.user_id = auth.uid()
        and (s.suspended_until is null or s.suspended_until > now())
    )
  );

-- UPDATE: admin만 (status·admin_note 변경)
drop policy if exists event_keyring_entries_update_admin on public.event_keyring_entries;
create policy event_keyring_entries_update_admin
  on public.event_keyring_entries
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- DELETE: 본인 (응모 취소) 또는 admin
drop policy if exists event_keyring_entries_delete on public.event_keyring_entries;
create policy event_keyring_entries_delete
  on public.event_keyring_entries
  for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

comment on table public.event_keyring_entries is
  '1000명 이벤트 키링 추첨 응모자 정보. user당 1회.';

notify pgrst, 'reload schema';
-- 끝.
