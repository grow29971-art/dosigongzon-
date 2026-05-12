-- ══════════════════════════════════════════════════════════════
-- 도배 trigger admin 면제 — 운영자 broadcast 기능 지원
-- 작성: 2026-05-12
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent)
-- ⚠ Chrome 번역 OFF
--
-- 이전 마이그레이션(supabase_abuse_defense_migration.sql)이 적용된 후 실행.
-- DM·게시글·댓글 도배 trigger 함수에 admin sender 면제 추가.
-- 운영자(admins 테이블 등록자)는 일괄 환영 쪽지·공지를 위해 도배 제한 통과.
-- ══════════════════════════════════════════════════════════════


-- ── DM ──
create or replace function public.check_dm_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_min int;
  per_hour int;
  is_admin boolean;
begin
  -- admin은 도배 제한 면제 (broadcast·환영 쪽지용)
  select exists(select 1 from public.admins where user_id = new.sender_id) into is_admin;
  if is_admin then
    return new;
  end if;

  -- 같은 (sender, receiver) 1분 5건
  select count(*) into per_min
  from public.direct_messages
  where sender_id = new.sender_id
    and receiver_id = new.receiver_id
    and created_at > now() - interval '1 minute';

  if per_min >= 5 then
    raise exception '같은 분께 1분에 5개 이상 쪽지를 보낼 수 없어요. 잠시 후 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  -- 같은 sender 시간 30건
  select count(*) into per_hour
  from public.direct_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if per_hour >= 30 then
    raise exception '쪽지를 너무 많이 보냈어요. 1시간 후 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


-- ── 게시글 ──
create or replace function public.check_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
  is_admin boolean;
begin
  select exists(select 1 from public.admins where user_id = new.author_id) into is_admin;
  if is_admin then
    return new;
  end if;

  select count(*) into per_hour
  from public.posts
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if per_hour >= 5 then
    raise exception '1시간 안에 5개 이상 글을 올릴 수 없어요. 잠시 후 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


-- ── 게시글 댓글 ──
create or replace function public.check_post_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
  is_admin boolean;
begin
  select exists(select 1 from public.admins where user_id = new.author_id) into is_admin;
  if is_admin then
    return new;
  end if;

  select count(*) into per_hour
  from public.post_comments
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if per_hour >= 20 then
    raise exception '1시간 안에 20개 이상 댓글을 달 수 없어요. 잠시 후 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


-- ── 고양이 댓글 ──
create or replace function public.check_cat_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
  is_admin boolean;
begin
  select exists(select 1 from public.admins where user_id = new.author_id) into is_admin;
  if is_admin then
    return new;
  end if;

  select count(*) into per_hour
  from public.cat_comments
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if per_hour >= 20 then
    raise exception '1시간 안에 20개 이상 댓글을 달 수 없어요. 잠시 후 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


-- 신고(reports)는 admin이 직접 신고할 일 없으니 면제 추가 안 함.
-- (신고 도배 방지의 본래 목적이 정상 사용자 보호이므로 admin도 동일 규칙 적용)
