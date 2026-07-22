-- ══════════════════════════════════════════
-- funnel_events INSERT RLS 정책 재적용 v3 (2026-07-22)
-- v2 실패 원인: 자가 테스트 블록의 rollback이 (에디터가 전체를 한 트랜잭션으로 묶는 탓에)
-- 앞의 GRANT·정책까지 전부 되돌렸다. 테스트 블록 제거 — 검증은 외부 REST로 한다.
-- 실행: Supabase SQL Editor에서 전체 실행
-- ══════════════════════════════════════════

-- 0) 테이블 권한 — RLS 이전 단계의 role 권한 보장
grant usage on schema public to anon, authenticated;
grant insert on table public.funnel_events to anon, authenticated;

-- 1) INSERT 정책: 비로그인(anon) 포함 누구나 — 단 user_id는 본인 또는 null만
drop policy if exists "funnel_events_insert" on public.funnel_events;
create policy "funnel_events_insert" on public.funnel_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- RLS 활성 상태 재확인 (켜져 있어야 정상)
alter table public.funnel_events enable row level security;

-- 적용 확인 — funnel_events_insert 1행 + grant 2행이 보여야 함
select policyname, roles, cmd, with_check from pg_policies where tablename = 'funnel_events';
select grantee, privilege_type from information_schema.role_table_grants
 where table_name = 'funnel_events' and grantee in ('anon','authenticated');

-- ══════════════════════════════════════════
-- 롤백
-- drop policy if exists "funnel_events_insert" on public.funnel_events;
-- revoke insert on table public.funnel_events from anon, authenticated;
-- ══════════════════════════════════════════
