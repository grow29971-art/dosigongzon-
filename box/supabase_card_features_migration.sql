-- ── 카드 시스템 확장: 대표 카드 / 배틀 / 자랑 ──

-- 1. 대표 카드 (프로필)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rep_card_cat_id UUID REFERENCES cats(id) ON DELETE SET NULL;

-- 2. 배틀 기록
CREATE TABLE IF NOT EXISTS card_battles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenger_cat_id UUID NOT NULL REFERENCES cats(id)     ON DELETE CASCADE,
  opponent_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_cat_id   UUID NOT NULL REFERENCES cats(id)     ON DELETE CASCADE,
  winner_id         UUID REFERENCES profiles(id)          ON DELETE SET NULL,
  challenger_hp_left INT,
  opponent_hp_left   INT,
  rounds             INT,
  battle_log         JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE card_battles ENABLE ROW LEVEL SECURITY;

-- 본인 배틀만 조회
CREATE POLICY "card_battles_select" ON card_battles
  FOR SELECT USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- 인증 유저만 INSERT (API에서 service_role 사용)
-- service_role bypasses RLS

-- 3. 게시글 카드 첨부
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS card_cat_id UUID REFERENCES cats(id) ON DELETE SET NULL;

-- 결과
SELECT 'card features migration done' AS status;
