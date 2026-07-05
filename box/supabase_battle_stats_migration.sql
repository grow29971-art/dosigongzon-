-- ── 배틀 스탯 + 돌봄 진화 ──

-- 1. 배틀 전용 스탯 컬럼 추가
ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS battle_atk     INT,
  ADD COLUMN IF NOT EXISTS battle_def     INT,
  ADD COLUMN IF NOT EXISTS battle_eva     INT,   -- 회피율 % (0~35)
  ADD COLUMN IF NOT EXISTS battle_crit    INT,   -- 치명타율 % (5~30)
  ADD COLUMN IF NOT EXISTS battle_special TEXT;  -- 특수 스킬 ID

-- 2. 기존 카드 중 battle_atk NULL인 것 랜덤 초기값 부여
DO $$
DECLARE
  r RECORD;
  v_atk_min  INT; v_atk_max  INT;
  v_def_min  INT; v_def_max  INT;
  v_eva_min  INT; v_eva_max  INT;
  v_crit_min INT; v_crit_max INT;
  v_skills   TEXT[];
BEGIN
  FOR r IN
    SELECT id, card_rarity FROM cats
    WHERE card_generated_at IS NOT NULL AND battle_atk IS NULL
  LOOP
    CASE r.card_rarity
      WHEN 'common'    THEN v_atk_min:=20; v_atk_max:=45; v_def_min:=15; v_def_max:=35; v_eva_min:=3;  v_eva_max:=10;  v_crit_min:=5;  v_crit_max:=12;  v_skills:=ARRAY['sharp_claws','quick_dodge','focus','intimidate_sm'];
      WHEN 'uncommon'  THEN v_atk_min:=35; v_atk_max:=60; v_def_min:=25; v_def_max:=50; v_eva_min:=7;  v_eva_max:=18;  v_crit_min:=8;  v_crit_max:=18;  v_skills:=ARRAY['freeze','scratch','intimidate','pounce'];
      WHEN 'rare'      THEN v_atk_min:=50; v_atk_max:=75; v_def_min:=40; v_def_max:=65; v_eva_min:=12; v_eva_max:=25;  v_crit_min:=12; v_crit_max:=24;  v_skills:=ARRAY['poison','bind','slow','double_strike'];
      WHEN 'legendary' THEN v_atk_min:=65; v_atk_max:=90; v_def_min:=55; v_def_max:=80; v_eva_min:=18; v_eva_max:=35;  v_crit_min:=18; v_crit_max:=30;  v_skills:=ARRAY['vampirism','invincible','dominate','regen'];
      ELSE v_atk_min:=20; v_atk_max:=45; v_def_min:=15; v_def_max:=35; v_eva_min:=3; v_eva_max:=10; v_crit_min:=5; v_crit_max:=12; v_skills:=ARRAY['sharp_claws','quick_dodge'];
    END CASE;

    UPDATE cats SET
      battle_atk     = v_atk_min  + floor(random()*(v_atk_max -v_atk_min +1))::INT,
      battle_def     = v_def_min  + floor(random()*(v_def_max -v_def_min +1))::INT,
      battle_eva     = v_eva_min  + floor(random()*(v_eva_max -v_eva_min +1))::INT,
      battle_crit    = v_crit_min + floor(random()*(v_crit_max-v_crit_min+1))::INT,
      battle_special = v_skills[1 + floor(random()*array_length(v_skills,1))::INT]
    WHERE id = r.id;
  END LOOP;
END $$;

SELECT 'battle stats migration done — ' || count(*) || ' cats updated' AS status
FROM cats WHERE battle_atk IS NOT NULL AND card_generated_at IS NOT NULL;
