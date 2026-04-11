-- ══════════════════════════════════════════
-- 신고(reports) + 문의(inquiries) 시스템
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_news_admin_migration.sql (admins 테이블 필요)
-- ⚠ Chrome 번역이 켜져있으면 꺼주세요
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. reports 테이블 (게시물/댓글/고양이 신고)
-- ──────────────────────────────────────────
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references auth.users(id) on delete set null,
  reporter_email text,
  reporter_name  text,
  target_type    text not null check (target_type in ('comment', 'cat', 'post')),
  target_id      text not null,
  target_snapshot text,  -- 대상 내용 스냅샷(본문 일부) — 삭제돼도 확인 가능
  reason         text not null check (reason in ('spam', 'abuse', 'inappropriate', 'false_info', 'other')),
  description    text,
  status         text not null default 'pending'
                 check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_note     text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- 본인이 신고한 것만 읽기
drop policy if exists "reports_read_own" on public.reports;
create policy "reports_read_own"
  on public.reports
  for select
  using (reporter_id = auth.uid());

-- admin은 전부 읽기
drop policy if exists "reports_read_admin" on public.reports;
create policy "reports_read_admin"
  on public.reports
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 로그인 유저는 본인 명의로 insert
drop policy if exists "reports_insert_auth" on public.reports;
create policy "reports_insert_auth"
  on public.reports
  for insert
  with check (auth.uid() = reporter_id);

-- admin만 update(상태/노트)
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- admin만 delete
drop policy if exists "reports_delete_admin" on public.reports;
create policy "reports_delete_admin"
  on public.reports
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 2. inquiries 테이블 (문의/불만)
-- ──────────────────────────────────────────
create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  user_email text,
  user_name  text,
  subject    text not null,
  body       text not null,
  status     text not null default 'pending'
             check (status in ('pending', 'replied', 'closed')),
  admin_note text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists inquiries_status_idx
  on public.inquiries (status, created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "inquiries_read_own" on public.inquiries;
create policy "inquiries_read_own"
  on public.inquiries
  for select
  using (user_id = auth.uid());

drop policy if exists "inquiries_read_admin" on public.inquiries;
create policy "inquiries_read_admin"
  on public.inquiries
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "inquiries_insert_auth" on public.inquiries;
create policy "inquiries_insert_auth"
  on public.inquiries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "inquiries_update_admin" on public.inquiries;
create policy "inquiries_update_admin"
  on public.inquiries
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "inquiries_delete_admin" on public.inquiries;
create policy "inquiries_delete_admin"
  on public.inquiries
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
