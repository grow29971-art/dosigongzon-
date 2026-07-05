-- ── 고양이 카드 레벨 시스템 v2: 레벨업 속도 하향 ──
-- 배틀 EXP(코드에서 조정: 자동 14/5, 수동 15/6)에 쿨다운이 없어 레벨업이 너무 빨랐음.
-- 돌봄 기록으로 얻는 XP(10/회, 2분 쿨다운)는 그대로 유지하고 레벨 임계값만 상향.
-- 기존 임계값: Lv2=50 ... Lv10=1670 → 신규: Lv2=90 ... Lv10=2800 (약 1.7배)

CREATE OR REPLACE FUNCTION compute_cat_card_level(p_exp INT)
RETURNS INT AS $$
  SELECT CASE
    WHEN p_exp >= 2800 THEN 10
    WHEN p_exp >= 2200 THEN 9
    WHEN p_exp >= 1690 THEN 8
    WHEN p_exp >= 1260 THEN 7
    WHEN p_exp >= 900  THEN 6
    WHEN p_exp >= 610  THEN 5
    WHEN p_exp >= 380  THEN 4
    WHEN p_exp >= 210  THEN 3
    WHEN p_exp >= 90   THEN 2
    ELSE 1
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- 결과 확인
SELECT 'card leveling v2 (slowdown) migration done' AS status;
