-- ── 배틀 특수스킬 4슬롯 확장 ──
-- 기존엔 특수스킬이 2개(battle_special, battle_special2)뿐이었음.
-- 요청: 스킬 4개 + 기본공격 + 방어 = 총 6개 액션 버튼으로 확장.
-- lib/battle-config.ts의 SKILL_POOL(등급별 10종)과 동일한 풀에서 배정.

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS battle_special3 TEXT,
  ADD COLUMN IF NOT EXISTS battle_special4 TEXT;

-- 기존 카드 전체에 battle_special3/4 백필 (이미 있는 special/special2와 최대한 안 겹치게)
DO $$
DECLARE
  c RECORD;
  idx3 INT; idx4 INT;
  n INT;

  common_pool    TEXT[] := ARRAY['sharp_claws','quick_dodge','focus','intimidate_sm','hiss','grooming','warm_nap','tail_whip','claw_flurry','body_slam'];
  uncommon_pool  TEXT[] := ARRAY['freeze','scratch','intimidate','pounce','ambush','static_shock','night_prowl','thunderclap','cold_glare','dash_strike'];
  rare_pool      TEXT[] := ARRAY['poison','bind','slow','double_strike','rend','howl','frenzy','curse','venom_fang','shockwave'];
  legendary_pool TEXT[] := ARRAY['vampirism','invincible','dominate','regen','eclipse','overdrive','meteor','cleanse','judgment','apocalypse_strike'];
  pool TEXT[];
BEGIN
  FOR c IN
    SELECT id, card_rarity, battle_special, battle_special2
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

    idx3 := 1 + (floor(random() * n)::int % n);
    IF pool[idx3] = c.battle_special OR pool[idx3] = c.battle_special2 THEN
      idx3 := (idx3 % n) + 1;
    END IF;

    idx4 := 1 + (floor(random() * n)::int % n);
    IF pool[idx4] = c.battle_special OR pool[idx4] = c.battle_special2 OR pool[idx4] = pool[idx3] THEN
      idx4 := (idx4 % n) + 1;
    END IF;

    UPDATE cats SET battle_special3 = pool[idx3], battle_special4 = pool[idx4] WHERE id = c.id;
  END LOOP;

  RAISE NOTICE '배틀 특수스킬3/4 백필 완료';
END $$;

-- 결과 확인
SELECT card_rarity, battle_special, battle_special2, battle_special3, battle_special4, COUNT(*)
FROM cats
WHERE card_generated_at IS NOT NULL
GROUP BY card_rarity, battle_special, battle_special2, battle_special3, battle_special4
ORDER BY card_rarity;
