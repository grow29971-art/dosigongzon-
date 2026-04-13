-- ══════════════════════════════════════════
-- 도시공존 — 미실행 마이그레이션 통합 스크립트
-- 이미 실행한 것도 재실행 안전 (if not exists / drop if exists)
-- Supabase SQL Editor에서 한 번에 실행
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 병원 좌표 컬럼
-- ──────────────────────────────────────────
alter table public.rescue_hospitals
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- ──────────────────────────────────────────
-- 2. 고양이 등록 제한 (가입 24h + 하루 1마리)
-- ──────────────────────────────────────────
create or replace function public.is_account_old_enough(uid uuid, min_hours int default 24)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = uid
      and created_at <= now() - (min_hours || ' hours')::interval
  );
$$;

create or replace function public.user_cats_created_within(uid uuid, minutes int)
returns int
language sql stable
as $$
  select count(*)::int from public.cats
  where caretaker_id = uid
    and created_at > now() - (minutes || ' minutes')::interval;
$$;

drop policy if exists "cats_insert_authenticated" on public.cats;
create policy "cats_insert_authenticated"
  on public.cats for insert
  with check (
    auth.uid() = caretaker_id
    and public.is_user_not_suspended(auth.uid())
    and public.is_account_old_enough(auth.uid(), 24)
    and public.user_cats_created_within(auth.uid(), 60 * 24) < 1
  );

-- ──────────────────────────────────────────
-- 3. 자동 숨김 (신고 3건)
-- ──────────────────────────────────────────
alter table public.cats add column if not exists hidden boolean not null default false;
alter table public.cat_comments add column if not exists hidden boolean not null default false;
alter table public.post_comments add column if not exists hidden boolean not null default false;

create or replace function public.auto_hide_reported_target()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  report_count int;
  hide_threshold constant int := 3;
begin
  select count(*) into report_count from public.reports
  where target_type = new.target_type and target_id = new.target_id and status <> 'dismissed';
  if report_count >= hide_threshold then
    begin
      if new.target_type = 'cat' then
        update public.cats set hidden = true where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'comment' then
        update public.cat_comments set hidden = true where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'post_comment' then
        update public.post_comments set hidden = true where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'post' then
        update public.posts set hidden = true where id = new.target_id::uuid and hidden = false;
      end if;
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_hide_reported on public.reports;
create trigger trg_auto_hide_reported
  after insert on public.reports for each row
  execute function public.auto_hide_reported_target();

-- 읽기 정책 갱신 (숨김 제외)
drop policy if exists "cats_read_public" on public.cats;
create policy "cats_read_public" on public.cats for select using (hidden = false);
drop policy if exists "cats_read_admin" on public.cats;
create policy "cats_read_admin" on public.cats for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "cat_comments_read_public" on public.cat_comments;
create policy "cat_comments_read_public" on public.cat_comments for select using (hidden = false);
drop policy if exists "cat_comments_read_admin" on public.cat_comments;
create policy "cat_comments_read_admin" on public.cat_comments for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "post_comments_read_public" on public.post_comments;
create policy "post_comments_read_public" on public.post_comments for select using (hidden = false);
drop policy if exists "post_comments_read_admin" on public.post_comments;
create policy "post_comments_read_admin" on public.post_comments for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 4. 경보 레벨 게이트
-- ──────────────────────────────────────────
alter table public.cat_comments drop constraint if exists cat_comments_alert_requires_level;
alter table public.cat_comments add constraint cat_comments_alert_requires_level
  check (kind <> 'alert' or (author_level is not null and author_level >= 1));

-- ──────────────────────────────────────────
-- 5. author_title 컬럼
-- ──────────────────────────────────────────
alter table public.posts add column if not exists author_title text;
alter table public.cat_comments add column if not exists author_title text;
alter table public.post_comments add column if not exists author_title text;

-- ──────────────────────────────────────────
-- 6. author_level 컬럼 (posts, post_comments, cat_comments)
-- ──────────────────────────────────────────
alter table public.posts add column if not exists author_level int;
alter table public.post_comments add column if not exists author_level int;
alter table public.cat_comments add column if not exists author_level int;

-- ──────────────────────────────────────────
-- 7. posts 테이블 (커뮤니티 DB 이전)
-- ──────────────────────────────────────────
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('emergency','foster','adoption','market','free')),
  title         text not null,
  content       text not null,
  author_id     uuid references auth.users(id) on delete set null,
  author_name   text,
  author_avatar_url text,
  author_title  text,
  author_level  int,
  region        text,
  images        text[] not null default '{}',
  is_pinned     boolean not null default false,
  view_count    int not null default 0,
  like_count    int not null default 0,
  dislike_count int not null default 0,
  comment_count int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists posts_category_created_idx on public.posts (category, created_at desc);
create index if not exists posts_pinned_created_idx on public.posts (is_pinned desc, created_at desc);
alter table public.posts enable row level security;

drop policy if exists "posts_read_public" on public.posts;
create policy "posts_read_public" on public.posts for select using (hidden = false);
drop policy if exists "posts_read_admin" on public.posts;
create policy "posts_read_admin" on public.posts for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth" on public.posts for insert
  with check (auth.uid() = author_id and public.is_user_not_suspended(auth.uid()));
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete using (auth.uid() = author_id);
drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin" on public.posts for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update using (auth.uid() = author_id);
drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin" on public.posts for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- posts avatar 컬럼 (이미 위에서 생성됨, 기존 테이블용)
alter table public.posts add column if not exists author_avatar_url text;

-- ──────────────────────────────────────────
-- 8. posts 카운터 RPC
-- ──────────────────────────────────────────
alter table public.posts add column if not exists dislike_count int not null default 0;

create or replace function public.post_view_inc(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin update public.posts set view_count = view_count + 1 where id = p_id; end; $$;
grant execute on function public.post_view_inc(uuid) to anon, authenticated;

create or replace function public.post_vote_update(p_id uuid, delta_like int, delta_dislike int)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if delta_like not in (-1, 0, 1) or delta_dislike not in (-1, 0, 1) then raise exception 'invalid delta'; end if;
  update public.posts set like_count = greatest(like_count + delta_like, 0), dislike_count = greatest(dislike_count + delta_dislike, 0) where id = p_id;
end;
$$;
grant execute on function public.post_vote_update(uuid, int, int) to authenticated;

-- comment count 동기화 트리거
create or replace function public.sync_post_comment_count()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_post_id uuid;
begin
  if tg_op = 'DELETE' then
    begin target_post_id := old.post_id::uuid; exception when others then return old; end;
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = target_post_id;
    return old;
  else
    begin target_post_id := new.post_id::uuid; exception when others then return new; end;
    update public.posts set comment_count = comment_count + 1 where id = target_post_id;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_sync_post_comment_count_ins on public.post_comments;
create trigger trg_sync_post_comment_count_ins after insert on public.post_comments for each row execute function public.sync_post_comment_count();
drop trigger if exists trg_sync_post_comment_count_del on public.post_comments;
create trigger trg_sync_post_comment_count_del after delete on public.post_comments for each row execute function public.sync_post_comment_count();

-- ──────────────────────────────────────────
-- 9. 관리자 유저 목록 함수
-- ──────────────────────────────────────────
create or replace function public.list_all_users()
returns table (
  id uuid, email text, nickname text, avatar_url text,
  created_at timestamptz, last_sign_in_at timestamptz,
  is_suspended boolean, suspended_reason text
)
language sql security definer set search_path = public, auth
as $$
  select
    u.id, u.email::text,
    coalesce((u.raw_user_meta_data->>'nickname')::text,(u.raw_user_meta_data->>'full_name')::text,(u.raw_user_meta_data->>'name')::text,split_part(u.email,'@',1)) as nickname,
    (u.raw_user_meta_data->>'avatar_url')::text,
    u.created_at, u.last_sign_in_at,
    exists (select 1 from public.user_suspensions s where s.user_id = u.id and (s.suspended_until is null or s.suspended_until > now())) as is_suspended,
    (select s.reason from public.user_suspensions s where s.user_id = u.id and (s.suspended_until is null or s.suspended_until > now()) limit 1) as suspended_reason
  from auth.users u
  where exists (select 1 from public.admins where user_id = auth.uid())
  order by u.created_at desc;
$$;
grant execute on function public.list_all_users() to authenticated;

-- ──────────────────────────────────────────
-- 10. 약품 가이드 테이블
-- ──────────────────────────────────────────
create table if not exists public.pharmacy_guide_items (
  id uuid primary key default gen_random_uuid(),
  name text not null, brand text, category text not null,
  color text not null default '#C47E5A', image_url text,
  description text not null, usage_info text, tip text, price text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pharmacy_guide_sort_idx on public.pharmacy_guide_items (sort_order asc, created_at desc);
alter table public.pharmacy_guide_items enable row level security;

drop policy if exists "pharmacy_guide_read_public" on public.pharmacy_guide_items;
create policy "pharmacy_guide_read_public" on public.pharmacy_guide_items for select using (true);
drop policy if exists "pharmacy_guide_insert_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_insert_admin" on public.pharmacy_guide_items for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "pharmacy_guide_update_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_update_admin" on public.pharmacy_guide_items for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "pharmacy_guide_delete_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_delete_admin" on public.pharmacy_guide_items for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 11. 지역 채팅
-- ──────────────────────────────────────────
create table if not exists public.area_chats (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text, author_avatar_url text, author_level int,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists area_chats_area_created_idx on public.area_chats (area, created_at desc);
alter table public.area_chats enable row level security;

drop policy if exists "area_chats_read_public" on public.area_chats;
create policy "area_chats_read_public" on public.area_chats for select using (true);
drop policy if exists "area_chats_insert_auth" on public.area_chats;
create policy "area_chats_insert_auth" on public.area_chats for insert
  with check (auth.uid() = author_id and public.is_user_not_suspended(auth.uid()));
drop policy if exists "area_chats_delete_own" on public.area_chats;
create policy "area_chats_delete_own" on public.area_chats for delete using (auth.uid() = author_id);

alter table public.area_chats replica identity full;

-- ──────────────────────────────────────────
-- 12. 1:1 쪽지
-- ──────────────────────────────────────────
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text, sender_avatar_url text,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  receiver_name text,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dm_receiver_idx on public.direct_messages (receiver_id, is_read, created_at desc);
create index if not exists dm_sender_idx on public.direct_messages (sender_id, created_at desc);
alter table public.direct_messages enable row level security;

drop policy if exists "dm_read_own" on public.direct_messages;
create policy "dm_read_own" on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
drop policy if exists "dm_insert_auth" on public.direct_messages;
create policy "dm_insert_auth" on public.direct_messages for insert
  with check (auth.uid() = sender_id and public.is_user_not_suspended(auth.uid()));
drop policy if exists "dm_update_read" on public.direct_messages;
create policy "dm_update_read" on public.direct_messages for update
  using (auth.uid() = receiver_id);

-- ──────────────────────────────────────────
-- 13. cats update admin 정책
-- ──────────────────────────────────────────
drop policy if exists "cats_update_admin" on public.cats;
create policy "cats_update_admin" on public.cats for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 14. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝! 모든 마이그레이션 완료.
