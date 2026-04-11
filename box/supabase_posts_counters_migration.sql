-- ══════════════════════════════════════════
-- posts 조회수/좋아요/싫어요 카운터 지원
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_posts_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. dislike_count 컬럼 추가
-- ──────────────────────────────────────────
alter table public.posts
  add column if not exists dislike_count int not null default 0;

-- ──────────────────────────────────────────
-- 2. 조회수 증가 함수
--    RLS 우회 필요(누구나 조회수 올릴 수 있어야 함)
-- ──────────────────────────────────────────
create or replace function public.post_view_inc(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
    set view_count = view_count + 1
    where id = p_id;
end;
$$;

grant execute on function public.post_view_inc(uuid) to anon, authenticated;

-- ──────────────────────────────────────────
-- 3. 좋아요/싫어요 델타 갱신 함수
--    delta_like, delta_dislike는 -1/0/+1만 허용
--    비음수 보장
-- ──────────────────────────────────────────
create or replace function public.post_vote_update(
  p_id uuid,
  delta_like int,
  delta_dislike int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if delta_like not in (-1, 0, 1) or delta_dislike not in (-1, 0, 1) then
    raise exception 'invalid delta';
  end if;

  update public.posts
    set like_count    = greatest(like_count + delta_like, 0),
        dislike_count = greatest(dislike_count + delta_dislike, 0)
    where id = p_id;
end;
$$;

grant execute on function public.post_vote_update(uuid, int, int) to authenticated;

-- ──────────────────────────────────────────
-- 4. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
