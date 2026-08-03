-- ============================================================================
-- 야생냥이(catch) 게임 P3 — 유저 게임 상태(catch_profiles) 마이그레이션 (2026-08-04)
-- 냥줍 도감(업적 수령·주간 의뢰·완벽 포획 카운트) 이식용. Supabase SQL Editor에서
-- 이 파일 전체를 1회 실행. 멱등(IF NOT EXISTS / CREATE OR REPLACE / DO-guard)이라
-- 재실행 무해. ⚠️ 이 파일은 스키마 이력 문서를 겸한다 — 절대 삭제 금지(보존 정책).
--
-- [설계] city profiles에는 가드 트리거(trg_guard_profile_sensitive ·
--   profiles_guard_protected_fields)와 기존 컬럼이 얽혀 있어 건드리지 않는다.
--   냥줍이 profiles에 얹었던 게임 상태(dex_photos · achievement_claims ·
--   last_quest_week · perfect_catch_count)를 전용 테이블 catch_profiles로 분리.
--   행은 가입 트리거 없이 필요할 때 lazy upsert로 생긴다(서버 라우트/RPC만 쓰기).
--
-- [구성]
--   1) catch_profiles            — 유저당 1행 게임 상태
--   2) claim_catch_achievement() — 업적 보상 수령 원자 RPC (키 append + 코인 지급)
--   3) bump_catch_perfect()      — 완벽 포획 카운트 원자 증분(lazy upsert 겸용)
--   4) increment_coins DO-guard  — 미실행 환경 대비 (기존 정의는 건드리지 않음)
--
-- [권한 모델] city 표준: RLS SELECT는 본인 행만, 쓰기는 전부 REVOKE →
--   service_role Route Handler / SECURITY DEFINER RPC 경유만 허용.
-- ============================================================================

-- ── 1) catch_profiles ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catch_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- 실체화 도감(종key → 내 실사진 URL) — city는 실사 촬영 플로우가 아직 없어 항상 {}.
  -- 컬럼은 냥줍 스키마 호환으로 미리 둔다(P5 실사 이식 시 코드만 켜면 됨).
  dex_photos JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 업적 수령 키 배열 — 예: ["first_catch","rare_1"] (업적당 평생 1회)
  achievement_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 주간 의뢰 상태 — 냥줍 last_quest_week 인코딩 그대로:
  --   "2026-W32"   = 이번 주 완료(보상 지급됨)
  --   "2026-W32:1" = 다회 의뢰 중간 진행(1회)
  -- 이 한 컬럼이 CAS(compare-and-swap) 원자 게이트다(냥줍 H2 보안패치 2026-07-31 계승):
  -- 갱신 UPDATE가 "예전 값과 일치할 때만" 성공하므로 동시 이벤트 N발 중 1발만 지급된다.
  quest_week TEXT,
  -- 예약 — 의뢰 다중화(동시 여러 의뢰) 시 의뢰별 진행도를 담을 자리. 현재 코드는 미사용.
  quest_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 완벽 포획 누적(업적 perfect_10 재료) — bump_catch_perfect()로만 증가
  perfect_catch_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catch_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 행만 (도감 화면이 anon key + 본인 JWT로 읽는다)
DROP POLICY IF EXISTS "catch_profiles_select_own" ON catch_profiles;
CREATE POLICY "catch_profiles_select_own" ON catch_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 쓰기: 전부 service_role 전용 — 클라 직접 조작(코인 파밍·업적 위조) 차단
REVOKE INSERT, UPDATE, DELETE ON catch_profiles FROM authenticated, anon;

-- ── 2) 업적 보상 수령 원자 RPC ──────────────────────────────────────────────
-- "수령 키 append + 코인 지급"을 한 트랜잭션으로 묶는다. append UPDATE 자체가
-- 원자 게이트: 이미 키가 있으면(?) 행이 안 바뀌고 false 반환 → 동시 N발 중 1발만 지급.
-- (냥줍 claim_achievement 설계 이식 — city는 코인이 increment_coins 단일 경로라
--  read-modify-write 폴백 없이 이 RPC가 유일한 지급 경로다)
CREATE OR REPLACE FUNCTION claim_catch_achievement(
  p_user UUID, p_key TEXT, p_reward INT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 서버 계산 보상만 받지만 방어적 상한(단일 업적 최대 300 + 여유)
  IF p_reward IS NULL OR p_reward < 0 OR p_reward > 10000 THEN
    RETURN false;
  END IF;

  -- lazy 행 생성 — 가입 트리거 없이 첫 수령 시점에 만들어진다
  INSERT INTO catch_profiles (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;

  -- 원자 게이트: 키가 아직 없을 때만 append (jsonb ? 연산자 = 배열 원소 존재 검사)
  UPDATE catch_profiles
     SET achievement_claims = achievement_claims || to_jsonb(p_key),
         updated_at = now()
   WHERE user_id = p_user
     AND NOT (achievement_claims ? p_key);
  IF NOT FOUND THEN
    RETURN false; -- 이미 수령(다른 기기/동시 요청이 선점)
  END IF;

  -- 같은 트랜잭션에서 코인 지급 — 실패 시 append도 함께 롤백된다
  PERFORM public.increment_coins(p_user, p_reward);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION claim_catch_achievement(UUID, TEXT, INT) FROM public;
REVOKE ALL ON FUNCTION claim_catch_achievement(UUID, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION claim_catch_achievement(UUID, TEXT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_catch_achievement(UUID, TEXT, INT) TO service_role;

-- ── 3) 완벽 포획 카운트 원자 증분 ───────────────────────────────────────────
-- 포획 라우트가 isPerfect 판정(서버 롤) 직후 호출. INSERT ... ON CONFLICT 한 문장이라
-- 행 부재(lazy 생성)와 동시 증분 유실이 모두 없다.
CREATE OR REPLACE FUNCTION bump_catch_perfect(p_user UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO catch_profiles (user_id, perfect_catch_count)
  VALUES (p_user, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET perfect_catch_count = catch_profiles.perfect_catch_count + 1,
        updated_at = now();
$$;

REVOKE ALL ON FUNCTION bump_catch_perfect(UUID) FROM public;
REVOKE ALL ON FUNCTION bump_catch_perfect(UUID) FROM anon;
REVOKE ALL ON FUNCTION bump_catch_perfect(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION bump_catch_perfect(UUID) TO service_role;

-- ── 4) increment_coins DO-guard — 미실행 환경 대비 ──────────────────────────
-- box/supabase_coins_tx_migration.sql(또는 catch_cards 마이그레이션)이 이미 실행된
-- DB면 이 블록은 아무것도 안 한다 (기존 정의를 덮어쓰지 않는 존재 검사 guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_coins'
  ) THEN
    CREATE FUNCTION public.increment_coins(p_user_id uuid, p_amount int)
    RETURNS int
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $fn$
      UPDATE public.profiles
         SET coins = greatest(0, coalesce(coins, 0) + p_amount)
       WHERE id = p_user_id
      RETURNING coins;
    $fn$;
    REVOKE EXECUTE ON FUNCTION public.increment_coins(uuid, int) FROM public, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.increment_coins(uuid, int) TO service_role;
  END IF;
END $$;

SELECT 'catch_profiles migration done' AS status;
