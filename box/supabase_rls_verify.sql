-- ══════════════════════════════════════════
-- RLS 실제 적용 상태 검증 리포트
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 목적: 마이그레이션이 실제로 적용됐고 정책이 남아있는지 확인.
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 코드에서 사용하는 테이블의 RLS enable 상태
--    모든 행의 rls_enabled = true 여야 함.
-- ──────────────────────────────────────────
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'cats',
    'cat_comments',
    'cat_comment_votes',
    'admins',
    'news',
    'rescue_hospitals',
    'post_comments',
    'reports',
    'inquiries',
    'user_suspensions'
  )
order by c.relname;

-- ──────────────────────────────────────────
-- 2. 각 테이블의 정책 개수 + 이름 목록
--    기대값은 아래 주석 비교. 숫자가 비면 "정책 없음 = 완전 오픈" 경고.
-- ──────────────────────────────────────────
select
  tablename,
  count(*) as policy_count,
  array_agg(policyname order by policyname) as policies
from pg_policies
where schemaname = 'public'
  and tablename in (
    'cats',
    'cat_comments',
    'cat_comment_votes',
    'admins',
    'news',
    'rescue_hospitals',
    'post_comments',
    'reports',
    'inquiries',
    'user_suspensions'
  )
group by tablename
order by tablename;

-- 기대 정책 (마이그레이션 기준):
--   admins: 1개  (admins_read_self)
--   cats: read_public + insert_authenticated + update/delete_own + cats_delete_admin
--   cat_comments: read_public + insert_authenticated + delete_own + cat_comments_delete_admin
--   cat_comment_votes: votes_read_public + insert/update/delete_own
--   inquiries: read_own + read_admin + insert_auth + update_admin + delete_admin
--   news: read_public + insert/update/delete_admin
--   post_comments: read_public + insert_auth + delete_own + delete_admin
--   reports: read_own + read_admin + insert_auth + update_admin + delete_admin
--   rescue_hospitals: read_public + insert/update/delete_admin
--   user_suspensions: read_self + read_admin + insert/update/delete_admin

-- ──────────────────────────────────────────
-- 3. admins 테이블에 insert 정책이 없는지 확인
--    (admin bootstrap은 service_role로만 가능해야 함)
--    아래 쿼리가 0행이어야 정상.
-- ──────────────────────────────────────────
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'admins'
  and cmd in ('INSERT', 'UPDATE', 'DELETE');

-- ──────────────────────────────────────────
-- 4. admin 게이트 정책이 실제로 public.admins를 참조하는지
--    qual에 "admins" 문자열이 있어야 정상.
-- ──────────────────────────────────────────
select
  tablename,
  policyname,
  cmd,
  (qual ilike '%admins%' or with_check ilike '%admins%') as references_admins
from pg_policies
where schemaname = 'public'
  and policyname ilike '%admin%'
order by tablename, policyname;

-- ──────────────────────────────────────────
-- 5. is_user_not_suspended 함수 존재 확인
--    cats/cat_comments/post_comments insert 정책이 이 함수에 의존.
-- ──────────────────────────────────────────
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname = 'is_user_not_suspended'
  and pronamespace = 'public'::regnamespace;

-- ──────────────────────────────────────────
-- 6. RLS 우회 가능한 테이블 검색
--    public 스키마에서 relrowsecurity = false 인 테이블은 전부 오픈.
--    내부 트리거용 테이블이 아니라면 위험.
-- ──────────────────────────────────────────
select c.relname as unprotected_table
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- 끝.
