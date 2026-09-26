-- ══════════════════════════════════════════
-- 가입 출처(signup_source) 기록이 한 번도 안 된 문제 (2026-09-26)
-- 증상: /api/bot/marketing/signups 실측 — 8/1 이후 가입 250명 전원 signup_source null.
-- 원인(추정): 이메일 유출 핫픽스(7/15)가 profiles SELECT 를 컬럼 목록으로 재부여했는데, 8/26 에 추가된
--   signup_source 는 목록에 없다. 클라(lib/funnel-repo syncSignupSourceOnce)의
--   update ... where signup_source is null 은 WHERE 에 쓰는 컬럼의 SELECT 권한이 필요해
--   "permission denied for column" 으로 매번 실패하고, catch 가 조용히 삼켰다.
-- 해결: 로그인 사용자에게만 signup_source SELECT 부여(anon 은 계속 못 봄).
--   유입 출처는 민감정보가 아니고, RLS 가 행 SELECT 를 열어 둔 상태라 로그인 사용자끼리는 서로의 값이 보인다 — 감수(사장님 2026-09-26).
-- 효과: 기존 가입자도 기기 localStorage 에 출처가 남아 있으면 다음 방문 때 자동 기록된다(가드 미설정 상태로 재시도 중).
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

grant select (signup_source) on public.profiles to authenticated;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증: 하루 뒤 봇 API — GET /api/bot/marketing/signups?since=2026-08-01 의 bySource 에 unknown 외 값이 생기면 성공.
--   또는 SQL: select signup_source, count(*) from profiles group by 1 order by 2 desc;
-- 롤백: revoke select (signup_source) on public.profiles from authenticated;
-- ══════════════════════════════════════════
-- 끝.
