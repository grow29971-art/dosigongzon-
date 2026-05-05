-- ══════════════════════════════════════════
-- 도시공존 — 숏폼 영상(shorts) 테이블 + RLS + Storage 버킷
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF (SQL을 망가뜨림)
-- 선행조건: supabase_news_admin_migration.sql (admins 테이블)
-- 목적: 운영자가 직접 업로드하고 모든 유저(비로그인 포함)가 보기만 하는 짧은 영상 피드
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. shorts 테이블
-- ──────────────────────────────────────────
create table if not exists public.shorts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  video_url       text not null,                       -- Supabase Storage 'shorts' 버킷 public URL
  thumbnail_url   text,                                -- 옵션 (포스터 이미지)
  duration_sec    int,                                 -- 옵션 (UI 표시용)
  width           int,                                 -- 옵션 (세로/가로 판별)
  height          int,
  view_count      bigint default 0 not null,
  like_count      bigint default 0 not null,
  sort_order      int default 0 not null,              -- 큰 값이 위
  pinned          boolean default false not null,      -- 최상단 고정
  published       boolean default true not null,
  created_by      uuid references auth.users(id) on delete set null,
  published_at    timestamptz default now() not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

-- 인덱스
create index if not exists shorts_published_idx
  on public.shorts (pinned desc, sort_order desc, published_at desc)
  where published = true;

create index if not exists shorts_created_at_idx
  on public.shorts (created_at desc);

-- ──────────────────────────────────────────
-- 2. RLS 정책
-- ──────────────────────────────────────────
alter table public.shorts enable row level security;

-- 발행된 영상만 누구나 읽기
drop policy if exists "shorts_read_public" on public.shorts;
create policy "shorts_read_public"
  on public.shorts
  for select
  using (published = true);

-- 관리자는 모든 영상 읽기 (초안 포함)
drop policy if exists "shorts_read_admin_all" on public.shorts;
create policy "shorts_read_admin_all"
  on public.shorts
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_insert_admin" on public.shorts;
create policy "shorts_insert_admin"
  on public.shorts
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_update_admin" on public.shorts;
create policy "shorts_update_admin"
  on public.shorts
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_delete_admin" on public.shorts;
create policy "shorts_delete_admin"
  on public.shorts
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. 조회수 / 좋아요 증가 RPC (RLS 우회용)
-- ──────────────────────────────────────────
create or replace function public.increment_short_view(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shorts
    set view_count = view_count + 1
    where id = p_id and published = true;
end;
$$;

revoke all on function public.increment_short_view(uuid) from public;
grant execute on function public.increment_short_view(uuid) to anon, authenticated;

create or replace function public.increment_short_like(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shorts
    set like_count = like_count + 1
    where id = p_id and published = true;
end;
$$;

revoke all on function public.increment_short_like(uuid) from public;
grant execute on function public.increment_short_like(uuid) to anon, authenticated;

-- ──────────────────────────────────────────
-- 4. updated_at 자동 갱신 트리거
-- ──────────────────────────────────────────
create or replace function public.shorts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shorts_updated_at_trigger on public.shorts;
create trigger shorts_updated_at_trigger
  before update on public.shorts
  for each row execute function public.shorts_set_updated_at();

-- ──────────────────────────────────────────
-- 5. Storage 버킷 'shorts' (public read, admin write)
-- ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shorts',
  'shorts',
  true,
  52428800,                                           -- 50MB 제한
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 누구나 읽기
drop policy if exists "shorts_storage_read_public" on storage.objects;
create policy "shorts_storage_read_public"
  on storage.objects
  for select
  using (bucket_id = 'shorts');

-- admin만 업로드/수정/삭제
drop policy if exists "shorts_storage_insert_admin" on storage.objects;
create policy "shorts_storage_insert_admin"
  on storage.objects
  for insert
  with check (
    bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

drop policy if exists "shorts_storage_update_admin" on storage.objects;
create policy "shorts_storage_update_admin"
  on storage.objects
  for update
  using (
    bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

drop policy if exists "shorts_storage_delete_admin" on storage.objects;
create policy "shorts_storage_delete_admin"
  on storage.objects
  for delete
  using (
    bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

-- ──────────────────────────────────────────
-- 6. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
