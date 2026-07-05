-- CatchCat 카드 시스템: cats 테이블에 카드 필드 추가
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_rarity text DEFAULT 'common'
  CHECK (card_rarity IN ('common', 'uncommon', 'rare', 'legendary'));
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_name text;
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_traits text[];
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_stats jsonb;
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_flavor text;
ALTER TABLE cats ADD COLUMN IF NOT EXISTS card_generated_at timestamptz;
