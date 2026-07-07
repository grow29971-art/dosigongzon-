-- 카드 위 "성장 훈장" 스티커 시스템 — 카드 자체(cats 테이블)에 영구 기록되는 두 카운터 추가.
--
-- 훈장은 "한 번 얻으면 절대 사라지지 않아야" 의미가 있다. 기존에 배틀 쪽에서 쓰던
-- win_streak은 지면 0으로 리셋되는 "현재 연승"이라 훈장 조건으로 못 쓴다. 그래서
-- 리셋되지 않는 all-time 최고 기록(best_win_streak)과 누적 PVE 승리 수(pve_win_count)를
-- 카드 단위로 새로 쌓는다. (profiles.best_win_streak/boss_defeats는 유저 전체 합산이라
-- "이 카드가" 이룬 기록을 보여주는 용도로는 안 맞음 — 카드별로 별도 추적.)
--
-- 훈장 판정 자체(레벨 만렙, best_win_streak >= N, pve_win_count >= N, 등록 후 경과일)는
-- 프론트(app/components/CatCard.tsx)에서 이 값들 + card_level + card_generated_at으로
-- 순수 계산하며, 별도 "훈장 획득 여부" 컬럼은 두지 않는다 — 기준이 바뀌어도 재계산만 하면
-- 되게 하기 위함(cat-grade 시스템과 동일한 설계 원칙).

ALTER TABLE cats ADD COLUMN IF NOT EXISTS best_win_streak integer NOT NULL DEFAULT 0;
ALTER TABLE cats ADD COLUMN IF NOT EXISTS pve_win_count integer NOT NULL DEFAULT 0;

-- RLS: cats 테이블은 이미 caretaker_id 기준 select/update 정책이 있어 별도 정책 추가 불필요.
-- 단, 이 두 컬럼은 배틀 API(app/api/cats/card-battle/route.ts, .../record/route.ts)가
-- service-role 키로 갱신하므로 RLS와 무관하게 항상 기록됨.
