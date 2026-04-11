-- ══════════════════════════════════════════
-- 커뮤니티 게시글 댓글(post_comments) 시스템
-- 선행: supabase_news_admin_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 0. is_user_not_suspended 함수 확보 (없으면 생성)
--    suspensions 마이그레이션이 먼저 실행 안 됐을 때도 안전
-- ──────────────────────────────────────────
create table if not exists public.user_suspensions (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  reason          text,
  suspended_until timestamptz,
  admin_note      text,
  suspended_by    uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now() not null
);

create or replace function public.is_user_not_suspended(uid uuid)
returns boolean
language sql stable as $$
  select not exists (
    select 1 from public.user_suspensions
    where user_id = uid
      and (suspended_until is null or suspended_until > now())
  );
$$;

-- ──────────────────────────────────────────
-- 1. post_comments 테이블
-- post_id는 text (로컬 게시글 id: seed-1, timestamp 등)
-- ──────────────────────────────────────────
create table if not exists public.post_comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           text not null,
  author_id         uuid references auth.users(id) on delete set null,
  author_name       text,
  author_avatar_url text,
  body              text not null,
  created_at        timestamptz default now() not null
);

create index if not exists post_comments_post_id_idx
  on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

-- 읽기: 누구나
drop policy if exists "post_comments_read_public" on public.post_comments;
create policy "post_comments_read_public"
  on public.post_comments
  for select
  using (true);

-- insert: 로그인 + 정지 아닌 유저
drop policy if exists "post_comments_insert_auth" on public.post_comments;
create policy "post_comments_insert_auth"
  on public.post_comments
  for insert
  with check (
    auth.uid() = author_id
    and public.is_user_not_suspended(auth.uid())
  );

-- delete: 본인
drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
  on public.post_comments
  for delete
  using (auth.uid() = author_id);

-- delete: admin
drop policy if exists "post_comments_delete_admin" on public.post_comments;
create policy "post_comments_delete_admin"
  on public.post_comments
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 2. reports.target_type 에 post_comment 추가
-- ──────────────────────────────────────────
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('comment', 'cat', 'post', 'post_comment'));

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';
