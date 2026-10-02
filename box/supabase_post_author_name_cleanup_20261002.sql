-- ══════════════════════════════════════════
-- 10/2 비로그인 노출 프로브 후속 (감사 결정 ③의 확장)
-- ① 게시글·게시글 댓글·고양이 댓글 작성자 표시명을 현재 닉네임으로 — care_logs만 정리돼 있었고,
--    예전 글엔 소셜 계정 실명 스냅샷이 남아 비로그인에 user_id와 함께 공개됐다(실측 posts 3·post_comments 3).
--    신규 행은 tr_force_author_identity가 이미 닉네임으로 강제하므로 기존 행만 대상.
--    제외: 관리자 계정, 운영 봇 계정(staff 배지 행을 가진 작성자 전부) — 페르소나 이름은 의도된 것.
--    원본은 private.author_name_backup_20261002에 보관(롤백용).
-- ② shorts_admin_stats: shorts 테이블 삭제 후 남은 고아 함수인데 라이브에서 anon 실행권이 살아 있다 → 실행권 회수.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF — 2026-10-02 실행·검증(백업 25행: 게시글 4·게시글 댓글 13·고양이 댓글 8, 불일치 0, shorts_admin_stats anon 실행권 false)
-- ══════════════════════════════════════════

-- ①
create table if not exists private.author_name_backup_20261002 (
  tbl text not null, id text not null, author_name text,
  backed_up_at timestamptz not null default now(),
  primary key (tbl, id)
);
alter table private.author_name_backup_20261002 enable row level security;

create temp table _excluded_authors as
  select user_id as uid from public.admins
  union select author_id from public.posts where author_title = 'staff' and author_id is not null
  union select author_id from public.post_comments where author_title = 'staff' and author_id is not null;

insert into private.author_name_backup_20261002 (tbl, id, author_name)
  select 'posts', t.id::text, t.author_name
    from public.posts t join public.profiles p on p.id = t.author_id
   where nullif(trim(p.nickname), '') is not null and t.author_name is distinct from p.nickname
     and t.author_id not in (select uid from _excluded_authors)
  union all
  select 'post_comments', t.id::text, t.author_name
    from public.post_comments t join public.profiles p on p.id = t.author_id
   where nullif(trim(p.nickname), '') is not null and t.author_name is distinct from p.nickname
     and t.author_id not in (select uid from _excluded_authors)
  union all
  select 'cat_comments', t.id::text, t.author_name
    from public.cat_comments t join public.profiles p on p.id = t.author_id
   where nullif(trim(p.nickname), '') is not null and t.author_name is distinct from p.nickname
     and t.author_id not in (select uid from _excluded_authors)
  on conflict (tbl, id) do nothing;

update public.posts t set author_name = p.nickname from public.profiles p
 where p.id = t.author_id and t.id::text in (select id from private.author_name_backup_20261002 where tbl = 'posts');
update public.post_comments t set author_name = p.nickname from public.profiles p
 where p.id = t.author_id and t.id::text in (select id from private.author_name_backup_20261002 where tbl = 'post_comments');
update public.cat_comments t set author_name = p.nickname from public.profiles p
 where p.id = t.author_id and t.id::text in (select id from private.author_name_backup_20261002 where tbl = 'cat_comments');

drop table _excluded_authors;

-- ②
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='shorts_admin_stats' loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- ── 검증 ──
-- select tbl, count(*) from private.author_name_backup_20261002 group by tbl;   → posts·post_comments 각 3 내외 예상
-- select has_function_privilege('anon', 'public.shorts_admin_stats()', 'execute'); → false
-- anon 프로브: GET /rest/v1/posts?select=author_id,author_name 를 profiles_public 닉네임과 대조 → 불일치는 운영 봇만
-- ── 롤백 ──
-- update public.posts t set author_name = b.author_name from private.author_name_backup_20261002 b where b.tbl = 'posts' and b.id = t.id::text;
-- update public.post_comments t set author_name = b.author_name from private.author_name_backup_20261002 b where b.tbl = 'post_comments' and b.id = t.id::text;
-- update public.cat_comments t set author_name = b.author_name from private.author_name_backup_20261002 b where b.tbl = 'cat_comments' and b.id = t.id::text;
-- grant execute on function public.shorts_admin_stats() to authenticated;
