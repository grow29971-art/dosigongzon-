-- ══════════════════════════════════════════
-- 🟠 보안: 게시글 좋아요/싫어요 서버 중복방지 (무한 좋아요 차단) — 2026-07-16
-- 문제: 게시글 투표는 서버 기록 테이블이 없고 중복방지가 클라 localStorage 뿐.
--       post_vote_update(p_id, delta_like, delta_dislike)이 delta를 ±1로만 제한할 뿐 호출 횟수 무제한.
--       → POST /rest/v1/rpc/post_vote_update {delta_like:1} 을 N번 반복하면 like_count 무한 증가
--         (인기글·랭킹 조작, 타인 글 무한 싫어요 폭격). 고양이 좋아요(cat_likes)는 PK로 이미 막힘.
-- 해결: post_votes(post_id, user_id) 1인1표 테이블을 만들고, post_vote_update를 "유저의 최종 투표
--       상태"를 기록·정정하는 멱등 함수로 재작성. 같은 방향 반복 요청은 no-op → 무한 증가 불가.
--       카운트 변화는 클라가 보낸 delta 크기를 믿지 않고, 서버에 기록된 이전 상태→목표 상태
--       '전이'로부터 서버가 직접 계산(자가치유).
--       ⚠ 관리자(admins)의 "매 클릭 +1 누적" 기능은 의도된 것이라 그대로 보존(우회 경로).
-- 클라 호환: lib/posts-repo.ts updatePostVote의 (delta_like, delta_dislike) 시그니처 그대로 사용.
--            함수가 delta 부호로 목표 상태를 추론하므로 클라 코드 변경 불필요.
-- 실행 위치: Supabase Dashboard → SQL Editor (⚠ Chrome 번역 OFF)
-- 선행: supabase_posts_migration.sql, supabase_posts_counters_migration.sql
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 1인1표 기록 테이블
--    value: 1=좋아요, -1=싫어요 (0=행 없음으로 표현)
-- ──────────────────────────────────────────
create table if not exists public.post_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_votes enable row level security;

-- 본인 투표 행만 조회/삽입/수정/삭제 (카운트 자체는 posts에서 공개 조회)
drop policy if exists post_votes_select_own on public.post_votes;
create policy post_votes_select_own on public.post_votes
  for select using (auth.uid() = user_id);

drop policy if exists post_votes_insert_own on public.post_votes;
create policy post_votes_insert_own on public.post_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists post_votes_update_own on public.post_votes;
create policy post_votes_update_own on public.post_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists post_votes_delete_own on public.post_votes;
create policy post_votes_delete_own on public.post_votes
  for delete using (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 2. post_vote_update 멱등 재작성
--    delta 부호로 "이번 요청의 목표 투표"를 추론:
--      delta_like = 1     → 목표 좋아요(1)
--      delta_dislike = 1  → 목표 싫어요(-1)
--      그 외(취소류)       → 목표 없음(0)
--    관리자는 기존처럼 raw delta 누적(1인1표 미적용).
-- ──────────────────────────────────────────
create or replace function public.post_vote_update(
  p_id uuid,
  delta_like int,
  delta_dislike int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_is_admin  boolean;
  v_target    smallint;
  v_current   smallint;
  v_d_like    int := 0;
  v_d_dislike int := 0;
begin
  if delta_like not in (-1, 0, 1) or delta_dislike not in (-1, 0, 1) then
    raise exception 'invalid delta';
  end if;

  if v_uid is null then
    raise exception 'auth required';
  end if;

  select exists(select 1 from public.admins where user_id = v_uid) into v_is_admin;

  -- 관리자: 의도된 "매 클릭 +1 누적" 유지 (1인1표 미적용)
  if v_is_admin then
    update public.posts
      set like_count    = greatest(like_count + delta_like, 0),
          dislike_count = greatest(dislike_count + delta_dislike, 0)
      where id = p_id;
    return;
  end if;

  -- 일반 유저: 목표 투표 상태 추론
  v_target := case
    when delta_like = 1 then 1
    when delta_dislike = 1 then -1
    else 0
  end;

  -- 현재 기록된 투표
  select value into v_current from public.post_votes
    where post_id = p_id and user_id = v_uid
    for update;
  v_current := coalesce(v_current, 0);

  -- 이미 목표 상태면 no-op → 무한 반복 요청 무력화
  if v_current = v_target then
    return;
  end if;

  -- 전이(current → target)로부터 카운트 변화를 서버가 직접 계산
  v_d_like    := (case when v_target = 1 then 1 else 0 end) - (case when v_current = 1 then 1 else 0 end);
  v_d_dislike := (case when v_target = -1 then 1 else 0 end) - (case when v_current = -1 then 1 else 0 end);

  -- 기록 테이블 반영
  if v_target = 0 then
    delete from public.post_votes where post_id = p_id and user_id = v_uid;
  else
    insert into public.post_votes (post_id, user_id, value)
      values (p_id, v_uid, v_target)
      on conflict (post_id, user_id) do update set value = excluded.value, created_at = now();
  end if;

  update public.posts
    set like_count    = greatest(like_count + v_d_like, 0),
        dislike_count = greatest(dislike_count + v_d_dislike, 0)
    where id = p_id;
end;
$$;

grant execute on function public.post_vote_update(uuid, int, int) to authenticated;

notify pgrst, 'reload schema';

-- 검증(실행 후): 일반 유저 JWT로
--   POST /rest/v1/rpc/post_vote_update {p_id, delta_like:1, delta_dislike:0} 을 5번 반복
--   → like_count는 +1까지만 오르고 이후 변화 없음(멱등). post_votes에 (post_id,user_id) 1행.
--   싫어요로 전환: {delta_like:-1, delta_dislike:1} → like_count-1, dislike_count+1.
--   관리자 계정은 매 호출 +1 누적(기존 동작 유지).

-- ── 롤백 ──
-- (함수를 원래 비멱등 버전으로 되돌리고 테이블 제거 — 구멍 재개방)
-- create or replace function public.post_vote_update(p_id uuid, delta_like int, delta_dislike int)
-- returns void language plpgsql security definer set search_path = public as $$
-- begin
--   if delta_like not in (-1,0,1) or delta_dislike not in (-1,0,1) then raise exception 'invalid delta'; end if;
--   update public.posts set like_count = greatest(like_count + delta_like, 0),
--     dislike_count = greatest(dislike_count + delta_dislike, 0) where id = p_id;
-- end; $$;
-- grant execute on function public.post_vote_update(uuid, int, int) to authenticated;
-- drop table if exists public.post_votes;
-- notify pgrst, 'reload schema';
