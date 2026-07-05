-- ── 카드 배틀 연승 기록 (매치메이킹 밸런싱용) ──
-- 연승 3회 이상부터는 승률 50%에 가까운 상대끼리 매칭하기 위해 필요.

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS win_streak INT NOT NULL DEFAULT 0;

SELECT 'cats win_streak migration done' AS status;
