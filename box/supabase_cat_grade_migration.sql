-- 고양이 카드 등급 산정 시스템 — cats 테이블에 규칙 기반 등급 필드 추가
--
-- app/api/cats/generate-card는 이제 Gemini가 등급을 직접 말하지 않는다 — Gemini는
-- 사진에서 보이는 특징(colors/pattern/traits/sex/confidence)만 추출하고, 그 결과를
-- lib/cat-grade.ts의 calculateCatGrade()에 대입해 나온 등급이 card_rarity(화면에 보이는
-- 등급, 전투 스탯 근거)의 실제 소스가 된다. grade 계열 컬럼은 그 산정 과정의 원본 근거
-- (원본 features, 산정 점수, 근거 문장, 신뢰도)를 남겨서 나중에 룰이 바뀌면 재산정할 수
-- 있게 하는 감사(audit)용 필드다. 단, grade='pending'(신뢰도 미달)은 card_rarity에는
-- 못 쓰는 임시값이라 그 경우 card_rarity는 일단 common으로 내려서 저장된다 — grade
-- 컬럼에는 pending이 그대로 남아있으니, 나중에 재판정 배치를 돌리면 실제 등급으로 갱신된다.

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
