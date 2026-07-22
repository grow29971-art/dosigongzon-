-- ══════════════════════════════════════════
-- funnel_events INSERT RLS 정책 재적용 v2 (2026-07-22)
-- 실측: anon INSERT가 42501(RLS 위반)로 전량 거부 — 정책 재생성 + 테이블 GRANT까지 포함.
-- (RLS 정책이 있어도 role에 INSERT GRANT가 없으면 거부된다)
-- 실행: Supabase SQL Editor에서 "전체" 실행 후, 맨 아래 테스트 블록 결과 확인
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

-- 2) 적용 확인 ① — funnel_events_insert 1행이 보여야 함
select policyname, roles, cmd, with_check from pg_policies where tablename = 'funnel_events';

-- 3) 적용 확인 ② — anon 역할로 실제 인서트 시뮬레이션 (성공하면 즉시 롤백, 데이터 안 남음)
begin;
set local role anon;
insert into public.funnel_events (anon_id, step) values ('sql-editor-role-test', 'onboarding_intro');
rollback;
-- 여기서 에러 없이 통과하면 수리 완료. 에러가 나면 그 메시지를 그대로 공유해줄 것.

-- ══════════════════════════════════════════
-- 롤백
-- drop policy if exists "funnel_events_insert" on public.funnel_events;
-- revoke insert on table public.funnel_events from anon, authenticated;
-- ══════════════════════════════════════════
