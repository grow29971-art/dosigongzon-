-- 도시공존 — 카드 배틀에 PVP/PVE 전적(승/패/무) 카드 표시 + 무승부 결과 지원
-- pve_win_count(기존 컬럼)는 그대로 "PVE 승수"로 계속 사용하고,
-- 나머지 승/패/무 카운터를 새로 추가한다.

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS pvp_wins   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_losses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_draws  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pve_losses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pve_draws  INT NOT NULL DEFAULT 0;

SELECT 'cats battle record + draw migration done' AS status;
