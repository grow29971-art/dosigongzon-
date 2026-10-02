-- ══════════════════════════════════════════
-- 권한·무결성 보강 (2026-10-02) — 2026-10-02 SQL Editor 실행·검증 완료
-- ① post_comments 읽기 정책 단일화(비밀 댓글 조건 포함)
-- ② 작성자 보호 트리거 3종 SECURITY INVOKER 전환(current_user 판정이 소유자로 고정되던 문제)
-- ③ 작성자·발신자 표시 정보를 profiles로 고정하는 트리거(7개 테이블)
-- ④ 서클 초대 토큰 + 가입 RPC 토큰 검증 + 멤버 행 직접 쓰기 가드
-- ⑤ invite_events 직접 INSERT 정책 제거(RPC 경유만)
-- ⑥ 서클 채팅 INSERT에 정지 계정 조건
-- ⑦ push_subscriptions 엔드포인트 CHECK + 유저당 10개
-- ⑧ 서버 전용 RPC 실행 권한 정리
-- ⑨ area_chats 길이·속도 제한
-- ⑩ cat_location_history 직접 INSERT 정책 제거(트리거 경유만)
-- ⑪ 공개 지도 뷰 퍼징 시드에 서버 비밀값
-- ⑫ AI 집사 유저당 일일 카운터
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ① 비밀 댓글
drop policy if exists "post_comments_read_public" on public.post_comments;
drop policy if exists "post_comments_read" on public.post_comments;
create policy "post_comments_read" on public.post_comments
  for select using (
    hidden = false
    and (
      is_secret = false
      or auth.uid() = author_id
      or exists (select 1 from public.posts p where p.id::text = post_comments.post_id and p.author_id = auth.uid())
    )
  );
-- (관리자 열람은 기존 post_comments_read_admin 정책)

-- ② 작성자 보호 트리거 실동작
alter function public.guard_posts_snapshot() security invoker;
alter function public.guard_post_comments_snapshot() security invoker;
alter function public.guard_cat_comments_snapshot() security invoker;

-- ③ 작성자·발신자 표시 정보 = profiles (직접 쓰기만. 서버·definer RPC·봇은 통과)
--    인자: (id 컬럼, 이름 컬럼, 아바타 컬럼). 없는 컬럼 키는 jsonb_populate_record가 무시한다.
create or replace function public.force_author_identity()
returns trigger
language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_nick text; v_avatar text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  v_id := (to_jsonb(new) ->> tg_argv[0])::uuid;
  select nickname, avatar_url into v_nick, v_avatar from profiles where id = v_id;
  new := jsonb_populate_record(new, jsonb_build_object(tg_argv[1], coalesce(nullif(trim(v_nick), ''), '이웃'), tg_argv[2], v_avatar));
  return new;
end $$;

drop trigger if exists tr_force_author_identity on public.posts;
create trigger tr_force_author_identity before insert on public.posts
  for each row execute function public.force_author_identity('author_id', 'author_name', 'author_avatar_url');
drop trigger if exists tr_force_author_identity on public.post_comments;
create trigger tr_force_author_identity before insert on public.post_comments
  for each row execute function public.force_author_identity('author_id', 'author_name', 'author_avatar_url');
drop trigger if exists tr_force_author_identity on public.cat_comments;
create trigger tr_force_author_identity before insert on public.cat_comments
  for each row execute function public.force_author_identity('author_id', 'author_name', 'author_avatar_url');
drop trigger if exists tr_force_author_identity on public.care_logs;
create trigger tr_force_author_identity before insert on public.care_logs
  for each row execute function public.force_author_identity('author_id', 'author_name', 'author_avatar_url');
drop trigger if exists tr_force_author_identity on public.area_chats;
create trigger tr_force_author_identity before insert on public.area_chats
  for each row execute function public.force_author_identity('author_id', 'author_name', 'author_avatar_url');
drop trigger if exists tr_force_author_identity on public.direct_messages;
create trigger tr_force_author_identity before insert on public.direct_messages
  for each row execute function public.force_author_identity('sender_id', 'sender_name', 'sender_avatar_url');
drop trigger if exists tr_force_author_identity on public.circle_messages;
create trigger tr_force_author_identity before insert on public.circle_messages
  for each row execute function public.force_author_identity('sender_id', 'sender_name', 'sender_avatar_url');

-- ④ 서클 초대 토큰
alter table public.caretaker_circles
  add column if not exists invite_token uuid not null default gen_random_uuid();

-- 내 서클 초대 토큰(없으면 서클 생성) — 마이페이지가 초대 링크를 만들 때 호출
create or replace function public.my_circle_invite_token()
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_token uuid;
begin
  if v_uid is null then raise exception '로그인이 필요해요.'; end if;
  select invite_token into v_token from caretaker_circles where owner_id = v_uid;
  if v_token is null then
    insert into caretaker_circles (owner_id, name) values (v_uid, '내 서클')
      on conflict (owner_id) do nothing;
    select invite_token into v_token from caretaker_circles where owner_id = v_uid;
  end if;
  return v_token;
end $$;
revoke all on function public.my_circle_invite_token() from public, anon;
grant execute on function public.my_circle_invite_token() to authenticated;

drop function if exists public.join_circle_by_owner(uuid);
create or replace function public.join_circle_by_owner(p_owner_id uuid, p_token text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_circle_id uuid; v_member_id uuid := auth.uid(); v_existing record;
begin
  if v_member_id is null then raise exception '로그인이 필요해요.'; end if;
  if v_member_id = p_owner_id then return 'self'; end if;
  select id into v_circle_id from caretaker_circles
   where owner_id = p_owner_id and invite_token::text = coalesce(p_token, '');
  if v_circle_id is null then
    raise exception '초대 링크가 올바르지 않아요. 초대한 분께 새 링크를 받아주세요.';
  end if;
  select id, status into v_existing from circle_members
   where circle_id = v_circle_id and member_id = v_member_id limit 1;
  if v_existing.id is not null then
    if v_existing.status = 'accepted' then return 'already'; end if;
    update circle_members set status = 'accepted', accepted_at = now() where id = v_existing.id;
    return 'accepted';
  end if;
  insert into circle_members (circle_id, member_id, status, accepted_at)
    values (v_circle_id, v_member_id, 'accepted', now());
  return 'accepted';
end $$;
revoke all on function public.join_circle_by_owner(uuid, text) from public, anon;
grant execute on function public.join_circle_by_owner(uuid, text) to authenticated;

-- 멤버 행 직접 쓰기 가드 — owner의 직접 초대는 pending만, 멤버의 수정은 status·accepted_at만
create or replace function public.guard_circle_members_write()
returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.accepted_at := null;
  else
    new.circle_id := old.circle_id;
    new.member_id := old.member_id;
    new.invited_at := old.invited_at;
  end if;
  return new;
end $$;
drop trigger if exists tr_guard_circle_members_write on public.circle_members;
create trigger tr_guard_circle_members_write before insert or update on public.circle_members
  for each row execute function public.guard_circle_members_write();

-- ⑤ invite_events 직접 INSERT 차단
drop policy if exists "invite_events_insert_self" on public.invite_events;

-- ⑥ 정지 계정 서클 채팅 차단
drop policy if exists "circle_messages_insert" on public.circle_messages;
create policy "circle_messages_insert" on public.circle_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_user_not_suspended(auth.uid())
    and (public.is_circle_owner_of(circle_id) or public.is_member_of_circle(circle_id))
  );

-- ⑦ 푸시 구독 엔드포인트 허용목록 + 유저당 10개
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_allowlist;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_allowlist
  check (endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/') not valid;

create or replace function public.push_subscriptions_cap()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from push_subscriptions where user_id = new.user_id) >= 10 then
    raise exception '알림 구독 기기가 너무 많아요.';
  end if;
  return new;
end $$;
drop trigger if exists tr_push_subscriptions_cap on public.push_subscriptions;
create trigger tr_push_subscriptions_cap before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_cap();

-- ⑧ 불필요한 실행 권한 회수
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('increment_daily_visit', 'generate_invite_code',
                                'increment_short_like', 'increment_short_view', 'increment_short_view_v2')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
drop policy if exists "shorts_view_events_insert_any" on public.shorts_view_events;

-- ⑨ area_chats 길이·속도 제한
alter table public.area_chats drop constraint if exists area_chats_body_len;
alter table public.area_chats add constraint area_chats_body_len check (char_length(body) between 1 and 500) not valid;
create or replace function public.area_chats_rate_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'authenticated'
     and (select count(*) from area_chats where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception '잠시 후 다시 보내주세요.';
  end if;
  return new;
end $$;
drop trigger if exists tr_area_chats_rate_guard on public.area_chats;
create trigger tr_area_chats_rate_guard before insert on public.area_chats
  for each row execute function public.area_chats_rate_guard();

-- ⑩ 위치 변경 이력 직접 INSERT 차단 (cats_log_location_change 트리거가 definer로 기록)
drop policy if exists "cat_location_history_insert" on public.cat_location_history;

-- ⑪ 비로그인 지도 퍼징 salt — private 스키마(PostgREST 비노출)에 비밀값, 뷰 정의의 시드에만 섞는다
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_secrets (k text primary key, v text not null);
insert into private.app_secrets (k, v)
  values ('fuzz_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (k) do nothing;
do $$ declare d text; begin
  d := pg_get_viewdef('public.cats_public_map'::regclass);
  if position('app_secrets' in d) = 0 then
    d := replace(d, '''_lat''::text', '(select v from private.app_secrets where k = ''fuzz_salt'') || ''_lat''::text');
    d := replace(d, '''_lng''::text', '(select v from private.app_secrets where k = ''fuzz_salt'') || ''_lng''::text');
    execute 'create or replace view public.cats_public_map as ' || d;
  end if;
end $$;

-- ⑫ AI 집사 유저당 일일 카운터 (KST 날짜, 서비스 전용)
create table if not exists public.ai_chat_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_chat_daily enable row level security;
create or replace function public.check_ai_chat_daily(p_user_id uuid, p_limit int)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count int;
begin
  insert into ai_chat_daily (user_id, day, count)
    values (p_user_id, (now() at time zone 'Asia/Seoul')::date, 1)
    on conflict (user_id, day) do update set count = ai_chat_daily.count + 1
      where ai_chat_daily.count < p_limit
    returning count into v_count;
  return v_count is not null;
end $$;
revoke all on function public.check_ai_chat_daily(uuid, int) from public, anon, authenticated;
grant execute on function public.check_ai_chat_daily(uuid, int) to service_role;

notify pgrst, 'reload schema';

-- ── 롤백 (항목별) ──
-- ① drop policy "post_comments_read" on public.post_comments;
--    create policy "post_comments_read_public" on public.post_comments for select using (hidden = false);
-- ② alter function public.guard_posts_snapshot() security definer; (post_comments·cat_comments 동일)
-- ③ drop trigger tr_force_author_identity on public.<7개 테이블>; drop function public.force_author_identity();
-- ④ drop trigger tr_guard_circle_members_write on public.circle_members; drop function public.guard_circle_members_write();
--    drop function public.join_circle_by_owner(uuid, text); drop function public.my_circle_invite_token();
--    box/supabase_circle_join_rpc_migration.sql 재실행; alter table public.caretaker_circles drop column invite_token;
-- ⑤ box/supabase_invites_migration.sql의 invite_events_insert_self 블록 재실행
-- ⑥ box/supabase_circle_messages_migration.sql의 circle_messages_insert 블록 재실행
-- ⑦ alter table public.push_subscriptions drop constraint push_subscriptions_endpoint_allowlist;
--    drop trigger tr_push_subscriptions_cap on public.push_subscriptions; drop function public.push_subscriptions_cap();
-- ⑧ grant execute on function <각 시그니처> to anon, authenticated; shorts_view_events_insert_any 정책 재생성
-- ⑨ alter table public.area_chats drop constraint area_chats_body_len; drop trigger tr_area_chats_rate_guard on public.area_chats;
-- ⑩ box/supabase_cat_location_history_migration.sql의 insert 정책 블록 재실행
-- ⑪ box/supabase_tamagotchi_coin_removal_20260829.sql의 cats_public_map 정의 재실행; drop schema private cascade;
-- ⑫ drop function public.check_ai_chat_daily(uuid, int); drop table public.ai_chat_daily;
