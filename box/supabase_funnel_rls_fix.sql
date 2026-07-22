-- ══════════════════════════════════════════
-- funnel_events INSERT RLS 정책 재적용 (2026-07-22 12에이전트 온보딩 회의)
-- 실측: anon INSERT가 42501(RLS 위반)로 전량 거부 — 7/17 마이그레이션에서
-- 테이블 생성부만 실행되고 정책부가 프로덕션에 적용되지 않았음 (QA·리서치 침투 테스트로 확인).
-- 온보딩 방문자는 전원 anon이라 계측이 배포 후 내내 0행이었다.
-- 실행: Supabase SQL Editor에서 전체 실행
-- ══════════════════════════════════════════

-- INSERT: 비로그인(anon) 포함 누구나 — 단 user_id는 본인 또는 null만
drop policy if exists "funnel_events_insert" on public.funnel_events;
create policy "funnel_events_insert" on public.funnel_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- SELECT/UPDATE/DELETE: 정책 없음 유지 → 클라이언트 조회 불가, 집계는 service_role로만.

-- 적용 확인 (결과에 funnel_events_insert 1행이 보여야 함)
select policyname, roles, cmd from pg_policies where tablename = 'funnel_events';

-- ══════════════════════════════════════════
-- 롤백
-- drop policy if exists "funnel_events_insert" on public.funnel_events;
-- ══════════════════════════════════════════
