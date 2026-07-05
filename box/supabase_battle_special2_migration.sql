-- ── 배틀 특수스킬 2슬롯 추가 ──
-- 기존엔 고양이 카드당 특수스킬(battle_special)이 1개뿐이었음.
-- "강공격" 자리를 실제 특수스킬 슬롯(battle_special2)으로 바꿔 스킬 다양성을 늘림.
-- lib/battle-config.ts의 SKILL_POOL(등급별 6종)과 동일한 풀에서 배정.

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS battle_special2 TEXT;

-- 기존 카드 전체에 battle_special2 백필 (battle_special과 겹치지 않게 시도)
DO $$
DECLARE
  c RECORD;
  idx2 INT;
  n INT;

  common_pool    TEXT[] := ARRAY['sharp_claws','quick_dodge','focus','intimidate_sm','hiss','grooming'];
  uncommon_pool  TEXT[] := ARRAY['freeze','scratch','intimidate','pounce','ambush','static_shock'];
  rare_pool      TEXT[] := ARRAY['poison','bind','slow','double_strike','rend','howl'];
  legendary_pool TEXT[] := ARRAY['vampirism','invincible','dominate','regen','eclipse','overdrive'];
  pool TEXT[];
BEGIN
  FOR c IN
    SELECT id, card_rarity, battle_special
    FROM   cats
    WHERE  card_generated_at IS NOT NULL
  LOOP
    pool := CASE c.card_rarity
      WHEN 'legendary' THEN legendary_pool
      WHEN 'rare'      THEN rare_pool
      WHEN 'uncommon'  THEN uncommon_pool
      ELSE                  common_pool
    END;
    n := array_length(pool, 1);

    idx2 := 1 + (floor(random() * n)::int % n);
    -- battle_special과 같은 스킬이 뽑히면 다음 인덱스로 밀기
    IF pool[idx2] = c.battle_special THEN
      idx2 := (idx2 % n) + 1;
    END IF;

    UPDATE cats SET battle_special2 = pool[idx2] WHERE id = c.id;
  END LOOP;

  RAISE NOTICE '배틀 특수스킬2 백필 완료';
END $$;

-- 결과 확인
SELECT card_rarity, battle_special, battle_special2, COUNT(*)
FROM cats
WHERE card_generated_at IS NOT NULL
GROUP BY card_rarity, battle_special, battle_special2
ORDER BY card_rarity;
