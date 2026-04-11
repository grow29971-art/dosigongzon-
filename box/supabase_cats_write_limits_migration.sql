-- ══════════════════════════════════════════
-- 고양이 등록 제한 (레이트리밋 + 신규 유저 유예)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_cats_schema.sql, supabase_suspensions_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
--
-- 정책:
--  1. 가입 후 24시간 이내 유저는 고양이 등록 불가 (장난 계정 차단)
--  2. 24시간 내 최대 1마리 (스팸/도배 전면 차단)
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 계정 나이 검사 함수
-- ──────────────────────────────────────────
create or replace function public.is_account_old_enough(uid uuid, min_hours int default 24)
returns boolean
language sql
stable
security definer  -- auth.users 읽기 권한 부여
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
    where id = uid
      and created_at <= now() - (min_hours || ' hours')::interval
  );
$$;

-- ──────────────────────────────────────────
-- 2. 최근 등록 수 카운트 함수
-- ──────────────────────────────────────────
create or replace function public.user_cats_created_within(uid uuid, minutes int)
returns int
language sql
stable
as $$
  select count(*)::int
  from public.cats
  where caretaker_id = uid
    and created_at > now() - (minutes || ' minutes')::interval;
$$;

-- ──────────────────────────────────────────
-- 3. cats_insert_authenticated 정책 갱신
--    기존: 본인 인증 + 정지 아님
--    추가: 계정 24h+ + 시간당 5마리 이하 + 하루 20마리 이하
-- ──────────────────────────────────────────
drop policy if exists "cats_insert_authenticated" on public.cats;
create policy "cats_insert_authenticated"
  on public.cats
  for insert
  with check (
    auth.uid() = caretaker_id
    and public.is_user_not_suspended(auth.uid())
    and public.is_account_old_enough(auth.uid(), 24)
    and public.user_cats_created_within(auth.uid(), 60 * 24) < 1
  );

-- ──────────────────────────────────────────
-- 4. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
