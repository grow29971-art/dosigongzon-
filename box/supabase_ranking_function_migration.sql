-- ══════════════════════════════════════════
-- 도시공존 — 캣맘 랭킹 RPC 함수 (SECURITY DEFINER)
-- 활동 점수: cat * 10 + comment + alert * 2 + likes_received * 2 + care_log * 2
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1. 활동 점수 + 순위가 매겨진 상위 N명 반환
create or replace function public.get_top_caretakers(limit_n integer default 50)
returns table (
  user_id uuid,
  nickname text,
  avatar_url text,
  cat_count integer,
  comment_count integer,
  care_count integer,
  likes_received integer,
  score integer,
  rank integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with scored as (
    select
      p.id as user_id,
      p.nickname,
      p.avatar_url,
      coalesce(c.cat_count, 0)::integer as cat_count,
      coalesce(cm.comment_count, 0)::integer as comment_count,
      coalesce(cm.alert_count, 0)::integer as alert_count,
      coalesce(cl.care_count, 0)::integer as care_count,
      coalesce(l.likes_received, 0)::integer as likes_received,
      (coalesce(c.cat_count, 0) * 10
        + coalesce(cm.comment_count, 0)
        + coalesce(cm.alert_count, 0) * 2
        + coalesce(l.likes_received, 0) * 2
        + coalesce(cl.care_count, 0) * 2)::integer as score
    from public.profiles p
    left join (
      select caretaker_id, count(*) as cat_count
      from public.cats
      where caretaker_id is not null
      group by caretaker_id
    ) c on c.caretaker_id = p.id
    left join (
      select author_id,
        count(*) as comment_count,
        count(*) filter (where kind = 'alert') as alert_count
      from public.cat_comments
      where author_id is not null
      group by author_id
    ) cm on cm.author_id = p.id
    left join (
      select author_id, count(*) as care_count
      from public.care_logs
      where author_id is not null
      group by author_id
    ) cl on cl.author_id = p.id
    left join (
      select author_id, sum(coalesce(like_count, 0)) as likes_received
      from public.cat_comments
      where author_id is not null
      group by author_id
    ) l on l.author_id = p.id
  )
  select
    s.user_id, s.nickname, s.avatar_url,
    s.cat_count, s.comment_count, s.care_count, s.likes_received,
    s.score,
    (rank() over (order by s.score desc))::integer as rank
  from scored s
  where s.score > 0
  order by s.score desc, s.user_id
  limit limit_n;
$$;

-- 2. 특정 유저의 본인 순위 반환 (Top N에 못 들었을 때 본인 위치 표시용)
create or replace function public.get_caretaker_rank(target_user_id uuid)
returns table (
  user_id uuid,
  nickname text,
  avatar_url text,
  cat_count integer,
  comment_count integer,
  care_count integer,
  score integer,
  rank integer,
  total_users integer
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with scored as (
    select
      p.id as user_id,
      p.nickname,
      p.avatar_url,
      coalesce(c.cat_count, 0)::integer as cat_count,
      coalesce(cm.comment_count, 0)::integer as comment_count,
      coalesce(cm.alert_count, 0)::integer as alert_count,
      coalesce(cl.care_count, 0)::integer as care_count,
      coalesce(l.likes_received, 0)::integer as likes_received,
      (coalesce(c.cat_count, 0) * 10
        + coalesce(cm.comment_count, 0)
        + coalesce(cm.alert_count, 0) * 2
        + coalesce(l.likes_received, 0) * 2
        + coalesce(cl.care_count, 0) * 2)::integer as score
    from public.profiles p
    left join (
      select caretaker_id, count(*) as cat_count
      from public.cats
      where caretaker_id is not null
      group by caretaker_id
    ) c on c.caretaker_id = p.id
    left join (
      select author_id,
        count(*) as comment_count,
        count(*) filter (where kind = 'alert') as alert_count
      from public.cat_comments
      where author_id is not null
      group by author_id
    ) cm on cm.author_id = p.id
    left join (
      select author_id, count(*) as care_count
      from public.care_logs
      where author_id is not null
      group by author_id
    ) cl on cl.author_id = p.id
    left join (
      select author_id, sum(coalesce(like_count, 0)) as likes_received
      from public.cat_comments
      where author_id is not null
      group by author_id
    ) l on l.author_id = p.id
  ),
  ranked as (
    select s.*, (rank() over (order by s.score desc))::integer as rank
    from scored s
    where s.score > 0
  )
  select
    r.user_id, r.nickname, r.avatar_url,
    r.cat_count, r.comment_count, r.care_count,
    r.score, r.rank,
    (select count(*)::integer from ranked) as total_users
  from ranked r
  where r.user_id = target_user_id;
$$;

-- 권한 부여 (anon · authenticated 모두 호출 가능 — 랭킹은 공개)
grant execute on function public.get_top_caretakers(integer) to anon, authenticated;
grant execute on function public.get_caretaker_rank(uuid) to anon, authenticated;
