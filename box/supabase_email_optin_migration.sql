-- ══════════════════════════════════════════
-- 이메일 마케팅 수신 동의 — 옵트인 방식으로 전환
-- 정보통신망법 제50조 준수 (사전 동의 필수, 기본 OFF)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 1. 기본값을 false로 변경 (신규 가입자 옵트아웃 상태)
ALTER TABLE public.profiles
  ALTER COLUMN email_digest_enabled SET DEFAULT false;

-- 2. 기존 유저는 유지 (이미 동의한 경우로 간주 — 실제로는 서비스 초기라 영향 적음)
-- 필요 시 전체 초기화:
-- UPDATE public.profiles SET email_digest_enabled = false;

NOTIFY pgrst, 'reload schema';
-- 끝.
