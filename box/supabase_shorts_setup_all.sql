-- ══════════════════════════════════════════════════════════════
-- 동물숏츠 — 통합 셋업 (4개 마이그레이션을 순서대로)
-- 작성: 2026-05-11
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
--
-- 기존에 마이그레이션 안 돌아가 있던 상태라 한 번에 정리.
-- 모두 idempotent (create if not exists / add if not exists) 라서
-- 재실행해도 안전함.
--
-- 선행조건: public.admins 테이블 (supabase_news_admin_migration.sql)
-- ══════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════
-- [1/4] shorts 테이블 + RLS + Storage 버킷
-- ════════════════════════════════════════════════

create table if not exists public.shorts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  video_url       text not null,
  thumbnail_url   text,
  duration_sec    int,
  width           int,
  height          int,
  view_count      bigint default 0 not null,
  like_count      bigint default 0 not null,
  sort_order      int default 0 not null,
  pinned          boolean default false not null,
  published       boolean default true not null,
  created_by      uuid references auth.users(id) on delete set null,
  published_at    timestamptz default now() not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index if not exists shorts_published_idx
  on public.shorts (pinned desc, sort_order desc, published_at desc)
  where published = true;

create index if not exists shorts_created_at_idx
  on public.shorts (created_at desc);

alter table public.shorts enable row level security;

drop policy if exists "shorts_read_public" on public.shorts;
create policy "shorts_read_public" on public.shorts for select using (published = true);

drop policy if exists "shorts_read_admin_all" on public.shorts;
create policy "shorts_read_admin_all" on public.shorts for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_insert_admin" on public.shorts;
create policy "shorts_insert_admin" on public.shorts for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_update_admin" on public.shorts;
create policy "shorts_update_admin" on public.shorts for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_delete_admin" on public.shorts;
create policy "shorts_delete_admin" on public.shorts for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create or replace function public.increment_short_view(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shorts set view_count = view_count + 1
    where id = p_id and published = true;
end;
$$;
revoke all on function public.increment_short_view(uuid) from public;
grant execute on function public.increment_short_view(uuid) to anon, authenticated;

create or replace function public.increment_short_like(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shorts set like_count = like_count + 1
    where id = p_id and published = true;
end;
$$;
revoke all on function public.increment_short_like(uuid) from public;
grant execute on function public.increment_short_like(uuid) to anon, authenticated;

create or replace function public.shorts_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists shorts_updated_at_trigger on public.shorts;
create trigger shorts_updated_at_trigger
  before update on public.shorts
  for each row execute function public.shorts_set_updated_at();

-- Storage 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shorts', 'shorts', true, 52428800,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shorts_storage_read_public" on storage.objects;
create policy "shorts_storage_read_public" on storage.objects for select
  using (bucket_id = 'shorts');

drop policy if exists "shorts_storage_insert_admin" on storage.objects;
create policy "shorts_storage_insert_admin" on storage.objects for insert
  with check (bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_storage_update_admin" on storage.objects;
create policy "shorts_storage_update_admin" on storage.objects for update
  using (bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "shorts_storage_delete_admin" on storage.objects;
create policy "shorts_storage_delete_admin" on storage.objects for delete
  using (bucket_id = 'shorts'
    and exists (select 1 from public.admins where user_id = auth.uid()));


-- ════════════════════════════════════════════════
-- [2/4] YouTube 임베드 컬럼
-- ════════════════════════════════════════════════

alter table public.shorts
  add column if not exists youtube_url      text,
  add column if not exists youtube_video_id text;

create index if not exists shorts_youtube_video_id_idx
  on public.shorts (youtube_video_id)
  where youtube_video_id is not null;

alter table public.shorts
  alter column video_url drop not null;

alter table public.shorts
  drop constraint if exists shorts_source_present;
alter table public.shorts
  add constraint shorts_source_present
  check (
    (video_url is not null and length(trim(video_url)) > 0)
    or
    (youtube_video_id is not null and length(trim(youtube_video_id)) > 0)
  );


-- ════════════════════════════════════════════════
-- [3/4] 채널 정보 컬럼
-- ════════════════════════════════════════════════

alter table public.shorts
  add column if not exists youtube_channel_name text,
  add column if not exists youtube_channel_url  text;


-- ════════════════════════════════════════════════
-- [4/4] 시청 이벤트 + 통계 RPC
-- ════════════════════════════════════════════════

create table if not exists public.shorts_view_events (
  short_id  uuid not null references public.shorts(id) on delete cascade,
  viewer_id text not null,
  viewed_at timestamptz default now() not null,
  primary key (short_id, viewer_id)
);

create index if not exists shorts_view_events_viewer_id_idx
  on public.shorts_view_events (viewer_id);

create index if not exists shorts_view_events_viewed_at_idx
  on public.shorts_view_events (viewed_at desc);

alter table public.shorts_view_events enable row level security;

drop policy if exists "shorts_view_events_insert_any" on public.shorts_view_events;
create policy "shorts_view_events_insert_any"
  on public.shorts_view_events for insert with check (true);

drop policy if exists "shorts_view_events_read_admin" on public.shorts_view_events;
create policy "shorts_view_events_read_admin"
  on public.shorts_view_events for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create or replace function public.increment_short_view_v2(p_id uuid, p_viewer_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shorts set view_count = view_count + 1
    where id = p_id and published = true;
  if p_viewer_id is not null and length(p_viewer_id) > 0 then
    insert into public.shorts_view_events (short_id, viewer_id)
      values (p_id, p_viewer_id)
      on conflict (short_id, viewer_id) do nothing;
  end if;
end;
$$;
revoke all on function public.increment_short_view_v2(uuid, text) from public;
grant execute on function public.increment_short_view_v2(uuid, text) to anon, authenticated;

create or replace function public.shorts_admin_stats()
returns table (
  total_viewers     bigint,
  total_view_pairs  bigint,
  total_view_count  bigint
)
language sql security definer set search_path = public as $$
  select
    (select count(distinct viewer_id) from public.shorts_view_events)::bigint,
    (select count(*) from public.shorts_view_events)::bigint,
    (select coalesce(sum(view_count), 0) from public.shorts)::bigint;
$$;
revoke all on function public.shorts_admin_stats() from public;
grant execute on function public.shorts_admin_stats() to authenticated;


-- ════════════════════════════════════════════════
-- 스키마 캐시 재로드
-- ════════════════════════════════════════════════
notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════
-- 검증 (모두 정상 결과여야 함)
-- ════════════════════════════════════════════════
select 'shorts table' as 항목,
       case when to_regclass('public.shorts') is null then '❌ 없음' else '✅ 생성됨' end as 상태
union all
select 'shorts_view_events',
       case when to_regclass('public.shorts_view_events') is null then '❌ 없음' else '✅ 생성됨' end
union all
select 'shorts bucket',
       case when exists (select 1 from storage.buckets where id = 'shorts')
            then '✅ 생성됨' else '❌ 없음' end;

-- 끝.
