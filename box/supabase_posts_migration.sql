-- ══════════════════════════════════════════
-- 커뮤니티 게시글(posts) — Supabase로 이전
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_news_admin_migration.sql, supabase_suspensions_migration.sql,
--       supabase_auto_hide_reported_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. posts 테이블
-- ──────────────────────────────────────────
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('emergency','foster','adoption','market','free')),
  title         text not null,
  content       text not null,
  author_id     uuid references auth.users(id) on delete set null,
  author_name   text,
  region        text,
  images        text[] not null default '{}',
  is_pinned     boolean not null default false,
  view_count    int not null default 0,
  like_count    int not null default 0,
  comment_count int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists posts_category_created_idx
  on public.posts (category, created_at desc);

create index if not exists posts_pinned_created_idx
  on public.posts (is_pinned desc, created_at desc);

alter table public.posts enable row level security;

-- ──────────────────────────────────────────
-- 2. RLS 정책
-- ──────────────────────────────────────────
-- 읽기: 숨김 아닌 글은 누구나
drop policy if exists "posts_read_public" on public.posts;
create policy "posts_read_public"
  on public.posts
  for select
  using (hidden = false);

-- 읽기: admin은 전부
drop policy if exists "posts_read_admin" on public.posts;
create policy "posts_read_admin"
  on public.posts
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- insert: 로그인 + 정지 아님 + 본인 명의
drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth"
  on public.posts
  for insert
  with check (
    auth.uid() = author_id
    and public.is_user_not_suspended(auth.uid())
  );

-- delete: 본인
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts
  for delete
  using (auth.uid() = author_id);

-- delete: admin
drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin"
  on public.posts
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- update: 본인이 content/title/images만 편집 (pinned 등은 admin만)
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts
  for update
  using (auth.uid() = author_id);

drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin"
  on public.posts
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. auto_hide_reported_target 트리거 함수 갱신
--    target_type = 'post'도 처리하도록 추가
-- ──────────────────────────────────────────
create or replace function public.auto_hide_reported_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_count int;
  hide_threshold constant int := 3;
begin
  select count(*) into report_count
  from public.reports
  where target_type = new.target_type
    and target_id = new.target_id
    and status <> 'dismissed';

  if report_count >= hide_threshold then
    begin
      if new.target_type = 'cat' then
        update public.cats
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'comment' then
        update public.cat_comments
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'post_comment' then
        update public.post_comments
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'post' then
        update public.posts
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      end if;
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

-- ──────────────────────────────────────────
-- 4. post_comments 수 자동 동기화 트리거
-- ──────────────────────────────────────────
create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  -- post_comments.post_id는 text (로컬 id 호환) — uuid로 변환 가능할 때만 posts 업데이트
  if tg_op = 'DELETE' then
    begin
      target_post_id := old.post_id::uuid;
    exception when others then
      return old;
    end;
    update public.posts
      set comment_count = greatest(comment_count - 1, 0)
      where id = target_post_id;
    return old;
  else
    begin
      target_post_id := new.post_id::uuid;
    exception when others then
      return new;
    end;
    update public.posts
      set comment_count = comment_count + 1
      where id = target_post_id;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_sync_post_comment_count_ins on public.post_comments;
create trigger trg_sync_post_comment_count_ins
  after insert on public.post_comments
  for each row
  execute function public.sync_post_comment_count();

drop trigger if exists trg_sync_post_comment_count_del on public.post_comments;
create trigger trg_sync_post_comment_count_del
  after delete on public.post_comments
  for each row
  execute function public.sync_post_comment_count();

-- ──────────────────────────────────────────
-- 5. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
