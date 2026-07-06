-- 고양이 카드 등급 산정 시스템 — cats 테이블에 규칙 기반 등급 필드 추가
--
-- 기존 card_rarity(text, CHECK IN common/uncommon/rare/legendary)는 Gemini 프롬프트가
-- 등급까지 직접 말해주는 기존 카드 생성 플로우(app/api/cats/generate-card)에서 쓰던 컬럼이라
-- 그대로 둔다. 이번에 추가하는 grade 계열 컬럼은 lib/cat-grade.ts의 calculateCatGrade()가
-- "실제 무늬/색/형질 룰"로 산정한 결과를 저장하는 별도 필드다 — 두 시스템을 같은 컬럼에
-- 억지로 합치지 않고 나란히 두었다가, 실제 AI 개체인식 모듈이 준비되면 어느 쪽을
-- card_rarity의 진실 공급원으로 쓸지 그때 정리하는 편이 안전하다.

ALTER TABLE cats ADD COLUMN IF NOT EXISTS grade text
  CHECK (grade IN ('common', 'uncommon', 'rare', 'legendary', 'pending'));
ALTER TABLE cats ADD COLUMN IF NOT EXISTS grade_reason text;      -- calculateCatGrade()가 만든 사람이 읽는 근거 문장
ALTER TABLE cats ADD COLUMN IF NOT EXISTS grade_score integer;    -- 산정에 쓰인 원점수 (재산정/감사용)
ALTER TABLE cats ADD COLUMN IF NOT EXISTS features jsonb;         -- AI 개체인식 원본 응답 (colors/pattern/traits/sex/confidence)
ALTER TABLE cats ADD COLUMN IF NOT EXISTS ai_confidence numeric;  -- 0.0~1.0, features.confidence를 그대로 복사 (조회 편의용)
ALTER TABLE cats ADD COLUMN IF NOT EXISTS graded_at timestamptz;  -- 등급이 (재)산정된 시각

-- 등급별 필터/집계 조회가 잦을 것을 대비한 인덱스
CREATE INDEX IF NOT EXISTS idx_cats_grade ON cats (grade);

-- RLS: cats 테이블은 이미 caretaker_id 기준 select/update 정책이 있으므로
-- (CLAUDE.md 기준 "모든 테이블에 적절한 정책 존재") 별도 정책 추가는 불필요.
-- 새 컬럼들도 기존 UPDATE 정책 범위 안에서 caretaker_id = auth.uid() 인 행만 갱신 가능.

-- ── 규칙이 바뀐 뒤 기존 카드 재산정하는 방법 ──
-- calculateCatGrade()는 순수 함수라, features(jsonb)만 저장돼 있으면 언제든 다시 계산할 수 있다.
-- 예: features가 NULL이 아닌 모든 cats 행을 읽어서
--   const result = calculateCatGrade(row.features);
--   update cats set grade=result.rarityKey, grade_reason=result.reason,
--                   grade_score=result.score, graded_at=now() where id=row.id
-- 를 배치로 돌리면 전체 재산정이 끝난다 (랜덤이 없어 몇 번을 다시 돌려도 같은 결과).
