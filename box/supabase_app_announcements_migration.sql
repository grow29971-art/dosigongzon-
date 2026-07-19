-- ══════════════════════════════════════════
-- 접속 팝업 공지 (app_announcements) 테이블 + RLS (2026-07-20)
-- 관리자가 등록하면 사용자 최초 접속 시 모달로 1회 표시(이후 로컬에서 안 봄).
-- 선행조건: admins 테이블(supabase_news_admin_migration.sql)이 먼저 있어야 함.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

create table if not exists public.app_announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists app_announcements_active_idx
  on public.app_announcements (created_at desc) where active = true;

-- ── RLS ──
alter table public.app_announcements enable row level security;

-- 활성 공지는 누구나(비로그인 포함) 읽기
drop policy if exists "announcements_read_active" on public.app_announcements;
create policy "announcements_read_active"
  on public.app_announcements
  for select
  using (active = true);

-- 관리자는 전체(비활성 포함) 읽기
drop policy if exists "announcements_read_admin" on public.app_announcements;
create policy "announcements_read_admin"
  on public.app_announcements
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 관리자만 등록
drop policy if exists "announcements_insert_admin" on public.app_announcements;
create policy "announcements_insert_admin"
  on public.app_announcements
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- 관리자만 수정(내리기 = active false)
drop policy if exists "announcements_update_admin" on public.app_announcements;
create policy "announcements_update_admin"
  on public.app_announcements
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- drop table if exists public.app_announcements cascade;
-- ══════════════════════════════════════════
