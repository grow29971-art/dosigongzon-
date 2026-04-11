-- ══════════════════════════════════════════
-- 유저 정지(user_suspensions) 시스템
-- 선행: supabase_news_admin_migration.sql, supabase_support_migration.sql
-- ⚠ Chrome 번역 OFF 확인
-- ══════════════════════════════════════════

create table if not exists public.user_suspensions (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  reason          text,
  suspended_until timestamptz,  -- null = 영구 정지
  admin_note      text,
  suspended_by    uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now() not null
);

create index if not exists user_suspensions_until_idx
  on public.user_suspensions (suspended_until);

alter table public.user_suspensions enable row level security;

-- 본인 정지 정보 읽기 (상태 체크용)
drop policy if exists "suspensions_read_self" on public.user_suspensions;
create policy "suspensions_read_self"
  on public.user_suspensions
  for select
  using (user_id = auth.uid());

-- admin 전체 읽기
drop policy if exists "suspensions_read_admin" on public.user_suspensions;
create policy "suspensions_read_admin"
  on public.user_suspensions
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- admin만 insert
drop policy if exists "suspensions_insert_admin" on public.user_suspensions;
create policy "suspensions_insert_admin"
  on public.user_suspensions
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- admin만 update
drop policy if exists "suspensions_update_admin" on public.user_suspensions;
create policy "suspensions_update_admin"
  on public.user_suspensions
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- admin만 delete (정지 해제)
drop policy if exists "suspensions_delete_admin" on public.user_suspensions;
create policy "suspensions_delete_admin"
  on public.user_suspensions
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- cat_comments / cats 에 admin 삭제 정책 추가
-- (기존 본인 삭제 정책은 그대로 유지, admin 추가)
-- ──────────────────────────────────────────
drop policy if exists "cat_comments_delete_admin" on public.cat_comments;
create policy "cat_comments_delete_admin"
  on public.cat_comments
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "cats_delete_admin" on public.cats;
create policy "cats_delete_admin"
  on public.cats
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 정지 유저 insert 차단 (cat_comments / cats)
-- 기존 정책에 suspension 체크 추가
-- ──────────────────────────────────────────
create or replace function public.is_user_not_suspended(uid uuid)
returns boolean
language sql stable as $$
  select not exists (
    select 1 from public.user_suspensions
    where user_id = uid
      and (suspended_until is null or suspended_until > now())
  );
$$;

-- cat_comments insert 정책 업데이트
drop policy if exists "cat_comments_insert_authenticated" on public.cat_comments;
create policy "cat_comments_insert_authenticated"
  on public.cat_comments
  for insert
  with check (
    auth.uid() = author_id
    and public.is_user_not_suspended(auth.uid())
  );

-- cats insert 정책 업데이트
drop policy if exists "cats_insert_authenticated" on public.cats;
create policy "cats_insert_authenticated"
  on public.cats
  for insert
  with check (
    auth.uid() = caretaker_id
    and public.is_user_not_suspended(auth.uid())
  );

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';
