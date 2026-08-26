-- ══════════════════════════════════════════
-- 가입자 유입 출처 귀속 (2026-08-26 원탁회의 — 그로스·리서치 수렴)
-- 배경: 인스타가 트래픽 71%(월 10만원 광고)인데 "어떤 가입자가 어디서 왔는지"가
--   없었다. funnel_events의 signup_home은 pending_care 경로에서만 발화해 구멍.
-- 해결: first-touch 출처(lib/funnel-repo captureSource, localStorage)를 로그인 후
--   1회 profiles.signup_source에 영구 기록. 클라이언트가 자기 행만, null일 때만 쓴다
--   (덮어쓰기 없음 — 코드에서 .is null 필터).
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.profiles
  add column if not exists signup_source text;

comment on column public.profiles.signup_source is
  '가입자 first-touch 유입 출처 (instagram/daangn/direct 등). 최초 1회만 기록, 계측용 — 신뢰 수준은 self-report와 동일.';

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증: 배포 후 아무 계정으로 로그인 → select signup_source from profiles where id = auth.uid();
-- 귀속 분포 조회: select signup_source, count(*) from profiles group by 1 order by 2 desc;
-- 롤백: alter table public.profiles drop column if exists signup_source;
-- ══════════════════════════════════════════
-- 끝.
