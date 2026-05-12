-- ══════════════════════════════════════════════════════════════
-- 도배·어뷰즈 방어 — 5/20 회원 모집 전 핫픽스
-- 작성: 2026-05-12
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent — 여러 번 실행 OK)
-- ⚠ Chrome 번역 OFF
--
-- 적용 내용 (5건):
-- 1. 신고 도배 방지 + 같은 대상 24h 1번 + 일일 10건
-- 2. DM 도배 (수신자당 1분 5건, 시간 30건)
-- 3. 게시글 도배 (시간 5건)
-- 4. 게시글·고양이 댓글 도배 (시간 20건)
-- 5. 정지 유저 신고 차단
--
-- 이 trigger들은 RAISE EXCEPTION을 던지므로 클라이언트엔 PostgreSQL 에러 메시지로
-- 노출됨. Supabase는 error.message를 사용자에게 전달하니 한국어로 작성.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- PART 1. 신고(reports) 도배 방지
-- ══════════════════════════════════════════════════════════════
-- 같은 reporter가 같은 target에 24h 안에 다시 신고 금지 (자동 숨김 트리거 악용 차단)
-- 한 reporter가 하루 10건 이상 신고 금지 (정상 사용자 집단 공격 차단)

create or replace function public.check_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_same_target int;
  daily_total int;
begin
  -- 1) 같은 (reporter, target_type, target_id) 24h 1번
  select count(*) into recent_same_target
  from public.reports
  where reporter_id = new.reporter_id
    and target_type = new.target_type
    and target_id = new.target_id
    and created_at > now() - interval '24 hours';

  if recent_same_target > 0 then
    raise exception '같은 대상을 24시간 안에 다시 신고할 수 없어요. 이미 접수된 신고는 운영자가 검토 중입니다.'
      using errcode = 'P0001';
  end if;

  -- 2) 한 reporter 일일 10건 제한
  select count(*) into daily_total
  from public.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '24 hours';

  if daily_total >= 10 then
    raise exception '하루 신고 한도(10건)를 초과했어요. 내일 다시 시도해주세요.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_reports_rate_limit on public.reports;
create trigger tr_reports_rate_limit
  before insert on public.reports
  for each row execute function public.check_report_rate_limit();


-- ══════════════════════════════════════════════════════════════
-- PART 2. 정지 유저 신고 차단
-- ══════════════════════════════════════════════════════════════
-- 정지된 사용자도 신고 가능했음 → 보복성 집단 신고 우려.
-- 다만 자기 정지 항소를 위해 신고는 별도 채널(메일) 안내가 필요할 수 있음.

drop policy if exists reports_insert_auth on public.reports;
create policy reports_insert_auth
  on public.reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_user_not_suspended()
  );


-- ══════════════════════════════════════════════════════════════
-- PART 3. DM(direct_messages) 도배 방지
-- ══════════════════════════════════════════════════════════════
-- 수신자당 1분 5건, 시간 30건. 같은 사람에게 1초 100개 보내는 공격 차단.

create or replace function public.check_dm_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_min int;
  per_hour int;
begin
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

  -- 같은 sender 시간 30건 (수신자 무관 전체)
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

drop trigger if exists tr_dm_rate_limit on public.direct_messages;
create trigger tr_dm_rate_limit
  before insert on public.direct_messages
  for each row execute function public.check_dm_rate_limit();


-- ══════════════════════════════════════════════════════════════
-- PART 4. 게시글(posts) 도배 방지
-- ══════════════════════════════════════════════════════════════
-- 시간 5건. 정상 사용자에겐 충분, 봇 도배는 차단.

create or replace function public.check_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
begin
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

drop trigger if exists tr_posts_rate_limit on public.posts;
create trigger tr_posts_rate_limit
  before insert on public.posts
  for each row execute function public.check_post_rate_limit();


-- ══════════════════════════════════════════════════════════════
-- PART 5. 게시글 댓글(post_comments) 도배 방지
-- ══════════════════════════════════════════════════════════════
-- 시간 20건.

create or replace function public.check_post_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
begin
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

drop trigger if exists tr_post_comments_rate_limit on public.post_comments;
create trigger tr_post_comments_rate_limit
  before insert on public.post_comments
  for each row execute function public.check_post_comment_rate_limit();


-- ══════════════════════════════════════════════════════════════
-- PART 6. 고양이 댓글(cat_comments) 도배 방지
-- ══════════════════════════════════════════════════════════════
-- 시간 20건.

create or replace function public.check_cat_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  per_hour int;
begin
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

drop trigger if exists tr_cat_comments_rate_limit on public.cat_comments;
create trigger tr_cat_comments_rate_limit
  before insert on public.cat_comments
  for each row execute function public.check_cat_comment_rate_limit();


-- ══════════════════════════════════════════════════════════════
-- 적용 확인
-- ══════════════════════════════════════════════════════════════
-- 아래 쿼리로 트리거 6개 모두 등록됐는지 확인:
--
-- select event_object_table, trigger_name
-- from information_schema.triggers
-- where trigger_name like 'tr_%_rate_limit'
-- order by event_object_table;
--
-- 결과 예시:
-- cat_comments         | tr_cat_comments_rate_limit
-- direct_messages      | tr_dm_rate_limit
-- post_comments        | tr_post_comments_rate_limit
-- posts                | tr_posts_rate_limit
-- reports              | tr_reports_rate_limit
-- ══════════════════════════════════════════════════════════════
