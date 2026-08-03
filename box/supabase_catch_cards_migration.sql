-- ============================================================================
-- 야생냥이(catch) 게임 P1 — 카드 + 상자 열기 마이그레이션 (2026-08-04)
-- 냥줍 위치 게임 이식 1단계. Supabase SQL Editor에서 이 파일 전체를 1회 실행.
-- 멱등(IF NOT EXISTS / CREATE OR REPLACE / DO-guard)이라 재실행 무해.
-- ⚠️ 이 파일은 스키마 이력 문서를 겸한다 — 절대 삭제 금지(마이그레이션 보존 정책).
--
-- [구성]
--   1) catch_cards       — 포획 카드. 냥줍 cards의 "통합 최종본"(init + geohash +
--                          retention/is_shiny + bond + play/gift_day + avatar_species).
--                          냥줍과 달리 caught_lat/lng 컬럼을 아예 만들지 않는다
--                          (프라이버시 — 위치는 geohash7 셀 ≈150m 하나만 저장).
--   2) catch_chest_opens — 골판지 상자 열기 장부 + open_catch_chest() advisory-lock RPC
--                          (냥줍 2026-07-31 보안패치 C2·C3 원자화 설계 그대로, catch_ 접두).
--   3) 코인 지급 — city 기존 public.increment_coins(uuid,int) 재사용
--                  (box/supabase_coins_tx_migration.sql, service_role 전용).
--                  미실행 환경 대비 동일 정의를 DO-guard로 포함(있으면 건드리지 않음).
--
-- [권한 모델] city 표준과 동일: RLS SELECT는 본인 행만, INSERT/UPDATE/DELETE는
--   REVOKE → 모든 쓰기는 service_role Route Handler 경유. (냥줍
--   supabase_security_migration.sql에서 전체 SELECT → owner-only로 조인 교훈 반영:
--   처음부터 owner-only로 시작한다. PVP 매칭 등 타인 카드 조회가 필요해지면
--   서버(service_role)가 읽는다 — 클라 정책을 넓히지 말 것.)
-- ============================================================================

-- ── 1) catch_cards ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catch_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  species_key TEXT NOT NULL,               -- lib/catch/spawn-species.ts 카탈로그 key
  -- 결정적 스폰 id("roam:{cell}:{day}:{index}" 등, lib/catch/wild.ts) — 같은 스폰을
  -- 같은 유저가 두 번 포획하는 것을 unique 제약으로 차단. 스폰 자체는 DB 미저장.
  spawn_id TEXT,
  card_name TEXT,
  card_rarity TEXT NOT NULL DEFAULT 'common',  -- lib/cat-grade-rules.ts GradeKey
  card_traits TEXT[],
  card_stats JSONB,
  card_flavor TEXT,
  card_level INT NOT NULL DEFAULT 1,
  card_exp INT NOT NULL DEFAULT 0,
  photo_url TEXT,                          -- nullable 유지 — 종 아트 폴백(speciesArtDataUrl)
  -- 배틀 스탯 — city lib/battle-config.ts generateBattleStats가 채운다
  battle_atk INT, battle_def INT, battle_eva INT, battle_crit INT,
  battle_special TEXT, battle_special2 TEXT, battle_special3 TEXT, battle_special4 TEXT,
  win_streak INT NOT NULL DEFAULT 0,
  best_win_streak INT NOT NULL DEFAULT 0,
  pve_win_count INT NOT NULL DEFAULT 0,
  pve_losses INT NOT NULL DEFAULT 0,
  pve_draws INT NOT NULL DEFAULT 0,
  pvp_wins INT NOT NULL DEFAULT 0,
  pvp_losses INT NOT NULL DEFAULT 0,
  pvp_draws INT NOT NULL DEFAULT 0,
  equipped_slots JSONB NOT NULL DEFAULT '{}',
  equipped_border_key TEXT,
  -- ── 위치: geohash7(≈150m 셀)만. 정밀 GPS 컬럼은 존재 자체가 없다 ──
  -- (냥줍은 caught_lat/lng를 만들었다가 geohash 마이그레이션에서 파기 +
  --  no_precise_gps CHECK로 봉인했다 — city는 컬럼 부재가 더 강한 보장)
  caught_geohash7 TEXT,
  caught_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ── 냥줍 후속 마이그레이션 통합분 ──
  is_shiny BOOLEAN NOT NULL DEFAULT false, -- 색다른 개체(retention_migration)
  features JSONB,                          -- 형질(무늬/색/특성 — bond_migration)
  bond INT NOT NULL DEFAULT 0,             -- 유대 게이지(bond_migration)
  last_met_at TIMESTAMPTZ,                 -- 마지막 재회(bond_migration)
  met_log JSONB NOT NULL DEFAULT '[]',     -- 재회 이력 — 좌표 금지, gh7/시각만(geohash 정책)
  play_day INT,                            -- 오늘 놀아준 날 인덱스(play_migration)
  gift_day INTEGER,                        -- 동거냥 선물 날 인덱스(home_cats_migration)
  avatar_species TEXT                      -- 지도 아바타 종 오버라이드(avatar_species_migration)
);

-- [P2 추가 2026-08-04] 쓰다듬기(app/api/catch/pet) 하루 1회 CAS 게이트용 —
-- 냥줍 supabase_pet_migration.sql 계승. 위 CREATE TABLE에 합치지 않고 ALTER로 둔 것은
-- P1 시점에 이미 테이블을 만든 환경도 재실행 한 번으로 따라잡게 하기 위함(멱등).
ALTER TABLE catch_cards ADD COLUMN IF NOT EXISTS last_petted_at TIMESTAMPTZ;

-- 중복 포획 최종 방어선 — 서버 검증을 뚫어도 같은 스폰은 1유저 1장
CREATE UNIQUE INDEX IF NOT EXISTS catch_cards_owner_spawn_unique
  ON catch_cards (owner_id, spawn_id) WHERE spawn_id IS NOT NULL;

-- 포획 쿨다운 조회(동일 셀 1시간 1회 등) — owner + 셀 + 시각
CREATE INDEX IF NOT EXISTS idx_catch_cards_owner_gh_time
  ON catch_cards (owner_id, caught_geohash7, caught_at DESC);

ALTER TABLE catch_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 카드만 (냥줍 security_migration 최종형)
DROP POLICY IF EXISTS "catch_cards_select_own" ON catch_cards;
CREATE POLICY "catch_cards_select_own" ON catch_cards
  FOR SELECT USING (auth.uid() = owner_id);

-- 쓰기: 전부 service_role Route Handler 전용
REVOKE INSERT, UPDATE, DELETE ON catch_cards FROM authenticated, anon;

-- ── 2) catch_chest_opens + open_catch_chest() ───────────────────────────────
-- 열기 장부 — RLS 활성 + 정책 없음 = service_role 전용(RPC만 기록).
CREATE TABLE IF NOT EXISTS catch_chest_opens (
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chest_id  TEXT NOT NULL,
  chest_day INT  NOT NULL,                 -- id에 박힌 UTC 일(세대) — 일일 캡 카운트용
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chest_id)
);
ALTER TABLE catch_chest_opens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS catch_chest_opens_user_day_idx
  ON catch_chest_opens (user_id, chest_day);

-- 상자 열기 원자 판정. 반환: 'ok' | 'dup'(이미 연 상자) | 'cap'(오늘 상한 초과).
-- 코인 지급은 호출부(라우트)가 'ok'일 때만 increment_coins로 별도 수행 — 보상 종류가
-- 서버 salt 롤(lib/catch/chest.ts rollChestReward)에 달려 있어 SQL 안에서 정하지 않는다.
-- 냥줍 C2(동시 N발 중복 지급)·C3(daily_claims 공유 파괴) 보안패치 반영:
--   • (user_id, chest_id) PK → 중복 열기 DB 원천 차단
--   • pg_advisory_xact_lock(유저별) → 중복검사+캡+INSERT 직렬화
--   • 전용 테이블 → 다른 데일리 기능과 상호 파괴 없음
CREATE OR REPLACE FUNCTION open_catch_chest(
  p_user UUID, p_chest TEXT, p_day INT, p_cap INT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('catch_chest_open:' || p_user::text));

  IF EXISTS (SELECT 1 FROM catch_chest_opens WHERE user_id = p_user AND chest_id = p_chest) THEN
    RETURN 'dup';
  END IF;

  SELECT count(*) INTO v_count FROM catch_chest_opens
    WHERE user_id = p_user AND chest_day = p_day;
  IF v_count >= p_cap THEN
    RETURN 'cap';
  END IF;

  INSERT INTO catch_chest_opens (user_id, chest_id, chest_day) VALUES (p_user, p_chest, p_day);
  RETURN 'ok';
END;
$$;

-- 클라이언트(anon/authenticated) 직접 호출 차단 — service_role 전용.
REVOKE ALL ON FUNCTION open_catch_chest(UUID, TEXT, INT, INT) FROM public;
REVOKE ALL ON FUNCTION open_catch_chest(UUID, TEXT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION open_catch_chest(UUID, TEXT, INT, INT) FROM authenticated;

-- ── 3) 코인 지급 RPC — city 기존 increment_coins 재사용 ─────────────────────
-- box/supabase_coins_tx_migration.sql이 이미 실행된 DB면 이 블록은 아무것도 안 한다.
-- (기존 정의를 덮어쓰지 않기 위해 CREATE OR REPLACE가 아닌 존재 검사 guard)
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

SELECT 'catch_cards migration done' AS status;
