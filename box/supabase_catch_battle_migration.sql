-- ============================================================================
-- 야생냥이(catch) 게임 P4 — 배틀·랭킹 마이그레이션 (2026-08-04)
-- 냥줍 배틀 축 이식 4단계. Supabase SQL Editor에서 이 파일 전체를 1회 실행.
-- 멱등(IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE)이라 재실행 무해.
-- ⚠️ 이 파일은 스키마 이력 문서를 겸한다 — 절대 삭제 금지(마이그레이션 보존 정책).
--
-- [구성]
--   1) catch_battle_tokens_used   — 수동 배틀 토큰 jti 1회용 소비 장부(replay 차단)
--                                   (냥줍 supabase_battle_token_migration.sql 계승)
--   2) catch_battles              — PVP 대전 기록(주간 랭킹 집계 재료)
--                                   (냥줍 card_battles 스키마 계승, catch_ 접두)
--   3) catch_ranking_settlements  — 주간 정산 멱등 장부(week_key PK가 지급 락)
--                                   (냥줍 supabase_ranking_settle_migration.sql 계승)
--   4) catch_profiles 배틀 컬럼   — boss_defeats·best_win_streak(업적) +
--                                   pve_seen/defeated_keys(조우 도감) +
--                                   last_battle_at(10초 파밍 스로틀)
--   5) spend_catch_coins()        — 코인 원자 차감 RPC(잔액 검증 포함) — 기술 재배정용
--
-- [권한 모델] city 표준: RLS SELECT는 본인 관련 행만, 쓰기는 전부 REVOKE →
--   service_role Route Handler 경유. 코인은 increment_coins/spend_catch_coins
--   원자 증분·차감 단일 경로(절대값 쓰기 금지).
-- ============================================================================

-- ── 1) catch_battle_tokens_used ─────────────────────────────────────────────
-- 수동 배틀 결과 기록(/api/catch/battle/record)이 서명 토큰의 jti를 소비 기록.
-- jti PK INSERT가 원자 락 — 같은 토큰 재제출(replay)로 코인·EXP를 파밍하는 것을
-- DB 계층에서 차단한다 (냥줍 2026-07-16 보안점검 설계 그대로).
CREATE TABLE IF NOT EXISTS catch_battle_tokens_used (
  jti     UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 토큰 유효기간(15분)이 지나면 행도 쓸모없다 — 필요 시 수동 청소용 인덱스.
CREATE INDEX IF NOT EXISTS idx_catch_battle_tokens_used_at
  ON catch_battle_tokens_used (used_at);

-- RLS 활성 + 정책 없음 = 클라이언트 완전 차단(service_role 전용 장부)
ALTER TABLE catch_battle_tokens_used ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catch_battle_tokens_used FROM authenticated, anon;

-- ── 2) catch_battles ────────────────────────────────────────────────────────
-- PVP 대전 기록. PVE(합성 상대)는 상대 카드가 DB에 없어 기록되지 않는다 —
-- 주간 랭킹이 자동으로 PVP만 집계하게 되는 구조적 필터.
CREATE TABLE IF NOT EXISTS catch_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenger_cat_id UUID REFERENCES catch_cards(id) ON DELETE SET NULL,
  opponent_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_cat_id   UUID REFERENCES catch_cards(id) ON DELETE SET NULL,
  winner_id         UUID,                -- NULL = 무승부
  challenger_hp_left INT NOT NULL DEFAULT 0,
  opponent_hp_left   INT NOT NULL DEFAULT 0,
  rounds             INT NOT NULL DEFAULT 0,
  battle_log         JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 주간 랭킹 집계(created_at 범위 스캔)용
CREATE INDEX IF NOT EXISTS idx_catch_battles_created_at
  ON catch_battles (created_at DESC);

ALTER TABLE catch_battles ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인이 참가한 배틀만 (랭킹 집계는 service_role이 담당)
DROP POLICY IF EXISTS "catch_battles_select_own" ON catch_battles;
CREATE POLICY "catch_battles_select_own" ON catch_battles
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

REVOKE INSERT, UPDATE, DELETE ON catch_battles FROM authenticated, anon;

-- ── 3) catch_ranking_settlements ────────────────────────────────────────────
-- 주간 정산 멱등 장부 — week_key(지난주 월요일 KST 날짜) PK insert가 지급 락.
CREATE TABLE IF NOT EXISTS catch_ranking_settlements (
  week_key   TEXT PRIMARY KEY,           -- 예: '2026-08-03' (그 주 월요일 KST)
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid       JSONB NOT NULL DEFAULT '[]' -- [{rank,userId,reward,score,wins,losses}]
);
ALTER TABLE catch_ranking_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catch_ranking_settlements FROM authenticated, anon;

-- ── 4) catch_profiles 배틀 컬럼 (멱등 ALTER) ────────────────────────────────
-- boss_defeats·best_win_streak: 배틀 업적(boss_5·streak_5) 진행값 — 도감이 본인
--   RLS SELECT로 읽고, 갱신은 배틀 라우트(service_role)만.
-- pve_seen_keys·pve_defeated_keys: PVE 조우 도감(배틀 탭) — 만난/이긴 로스터 키.
-- last_battle_at: 배틀 매칭 10초 파밍 스로틀(냥줍 supabase_hardening_migration.sql 계승).
ALTER TABLE catch_profiles ADD COLUMN IF NOT EXISTS boss_defeats INT NOT NULL DEFAULT 0;
ALTER TABLE catch_profiles ADD COLUMN IF NOT EXISTS best_win_streak INT NOT NULL DEFAULT 0;
ALTER TABLE catch_profiles ADD COLUMN IF NOT EXISTS pve_seen_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE catch_profiles ADD COLUMN IF NOT EXISTS pve_defeated_keys TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE catch_profiles ADD COLUMN IF NOT EXISTS last_battle_at TIMESTAMPTZ;

-- ── 5) spend_catch_coins() — 코인 원자 차감(잔액 검증) ──────────────────────
-- 기술 재배정(/api/catch/relearn, 60코인) 등 "코인을 쓰는" catch 기능용.
-- increment_coins는 greatest(0,…) 클램프라 잔액 검증이 없다 — 차감은 이 함수로만.
-- WHERE coins >= p_amount 조건부 UPDATE 한 문장이 검증+차감을 원자화:
-- 동시 N발이 와도 잔액이 있는 만큼만 성공하고, 부족하면 행이 안 바뀌어 NULL 반환.
CREATE OR REPLACE FUNCTION public.spend_catch_coins(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  UPDATE public.profiles
     SET coins = coins - p_amount
   WHERE id = p_user_id
     AND p_amount > 0
     AND coalesce(coins, 0) >= p_amount
  RETURNING coins;
$fn$;
REVOKE ALL ON FUNCTION public.spend_catch_coins(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_catch_coins(uuid, int) TO service_role;

SELECT 'catch_battle migration done' AS status;
