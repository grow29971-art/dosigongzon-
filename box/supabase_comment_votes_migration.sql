-- ══════════════════════════════════════════
-- cat_comments 좋아요/싫어요 시스템 (마이그레이션)
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_cat_comments_schema.sql 실행되어 있어야 함
-- ══════════════════════════════════════════

-- 1. 카운트 컬럼 추가
alter table public.cat_comments
  add column if not exists like_count    integer not null default 0,
  add column if not exists dislike_count integer not null default 0;

-- 2. 투표 테이블
create table if not exists public.cat_comment_votes (
  comment_id uuid not null references public.cat_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)), -- 1=like, -1=dislike
  created_at timestamptz default now() not null,
  primary key (comment_id, user_id)
);

create index if not exists cat_comment_votes_user_idx
  on public.cat_comment_votes (user_id);

-- 3. RLS
alter table public.cat_comment_votes enable row level security;

drop policy if exists "votes_read_public" on public.cat_comment_votes;
create policy "votes_read_public"
  on public.cat_comment_votes
  for select
  using (true);

drop policy if exists "votes_insert_own" on public.cat_comment_votes;
create policy "votes_insert_own"
  on public.cat_comment_votes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "votes_update_own" on public.cat_comment_votes;
create policy "votes_update_own"
  on public.cat_comment_votes
  for update
  using (auth.uid() = user_id);

drop policy if exists "votes_delete_own" on public.cat_comment_votes;
create policy "votes_delete_own"
  on public.cat_comment_votes
  for delete
  using (auth.uid() = user_id);

-- 4. 카운트 자동 유지 트리거
create or replace function public.update_comment_vote_counts()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    if new.vote = 1 then
      update public.cat_comments set like_count = like_count + 1 where id = new.comment_id;
    else
      update public.cat_comments set dislike_count = dislike_count + 1 where id = new.comment_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.vote = 1 then
      update public.cat_comments set like_count = greatest(0, like_count - 1) where id = old.comment_id;
    else
      update public.cat_comments set dislike_count = greatest(0, dislike_count - 1) where id = old.comment_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.vote <> new.vote then
      if new.vote = 1 then
        update public.cat_comments
          set like_count = like_count + 1,
              dislike_count = greatest(0, dislike_count - 1)
          where id = new.comment_id;
      else
        update public.cat_comments
          set like_count = greatest(0, like_count - 1),
              dislike_count = dislike_count + 1
          where id = new.comment_id;
      end if;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comment_vote_counts on public.cat_comment_votes;
create trigger trg_comment_vote_counts
after insert or update or delete on public.cat_comment_votes
for each row execute function public.update_comment_vote_counts();

-- 끝.
