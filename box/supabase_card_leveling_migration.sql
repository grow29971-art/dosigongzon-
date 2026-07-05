-- ── 고양이 카드 레벨 시스템 ──
-- 돌봄 1회 = 10 XP
-- 레벨 임계값 (누적 XP): Lv2=50, Lv3=120, Lv4=220, Lv5=350, Lv6=520, Lv7=730, Lv8=990, Lv9=1300, Lv10=1670

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS card_level INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_exp   INT NOT NULL DEFAULT 0;

-- 레벨 계산 함수 (누적 XP → 레벨)
CREATE OR REPLACE FUNCTION compute_cat_card_level(p_exp INT)
RETURNS INT AS $$
  SELECT CASE
    WHEN p_exp >= 1670 THEN 10
    WHEN p_exp >= 1300 THEN 9
    WHEN p_exp >= 990  THEN 8
    WHEN p_exp >= 730  THEN 7
    WHEN p_exp >= 520  THEN 6
    WHEN p_exp >= 350  THEN 5
    WHEN p_exp >= 220  THEN 4
    WHEN p_exp >= 120  THEN 3
    WHEN p_exp >= 50   THEN 2
    ELSE 1
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- EXP 추가 RPC (클라이언트에서 직접 호출 가능, auth.uid() 검증 포함)
CREATE OR REPLACE FUNCTION add_cat_card_exp(p_cat_id UUID, p_amount INT DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_prev_exp INT;
  v_new_exp  INT;
  v_prev_lvl INT;
  v_new_lvl  INT;
BEGIN
  -- 인증 확인
  IF v_uid IS NULL THEN
    RETURN '{"ok":false,"error":"unauthorized"}'::JSON;
  END IF;

  -- 해당 고양이에 최근 1분 내 care_log가 있는지 확인 (어뷰징 방지)
  IF NOT EXISTS (
    SELECT 1 FROM care_logs
    WHERE cat_id = p_cat_id
      AND author_id = v_uid
      AND created_at > NOW() - INTERVAL '2 minutes'
  ) THEN
    RETURN '{"ok":false,"error":"no_recent_log"}'::JSON;
  END IF;

  -- 카드가 생성된 고양이만 EXP 추가
  SELECT card_exp, card_level INTO v_prev_exp, v_prev_lvl
  FROM cats WHERE id = p_cat_id AND card_generated_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN '{"ok":false,"error":"no_card"}'::JSON;
  END IF;

  -- 최대 레벨이면 스킵
  IF v_prev_lvl >= 10 THEN
    RETURN json_build_object('ok', true, 'level', 10, 'exp', v_prev_exp, 'leveled_up', false);
  END IF;

  v_new_exp := v_prev_exp + p_amount;
  v_new_lvl := compute_cat_card_level(v_new_exp);

  UPDATE cats
  SET card_exp = v_new_exp, card_level = v_new_lvl
  WHERE id = p_cat_id;

  RETURN json_build_object(
    'ok',         true,
    'level',      v_new_lvl,
    'exp',        v_new_exp,
    'prev_level', v_prev_lvl,
    'leveled_up', v_new_lvl > v_prev_lvl
  );
END;
$$;

-- 결과 확인
SELECT 'card leveling migration done' AS status;
