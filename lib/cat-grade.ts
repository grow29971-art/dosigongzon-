// 고양이 카드 등급 산정 — 판정 로직
//
// 설계 원칙: AI 개체인식 모듈은 "특징만" 준다 (colors/pattern/traits/sex/confidence).
// 등급을 정하는 건 이 파일의 순수 함수 calculateCatGrade() 뿐이다.
// AI가 등급을 직접 말하게 하지 않는 이유:
//   - 등급 기준이 코드(lib/cat-grade-rules.ts)에 명시적으로 남아 사람이 읽고 설명할 수 있다.
//   - 같은 입력이면 항상 같은 등급이 나온다(랜덤 없음) — "우연이 아니라 설계"라는 제품 원칙과 일치.
//   - 규칙을 바꾼 뒤 저장된 features(JSONB)를 다시 이 함수에 넣기만 하면 기존 카드도 재산정된다.

import {
  type CatFeatures,
  type CatPattern,
  type CatSex,
  type GradeKey,
  GRADE_THRESHOLDS,
  PATTERN_SCORES,
  TRAIT_SCORES,
  COLOR_SCORES,
  MALE_PARTICOLOR_BONUS,
  MALE_PARTICOLOR_PATTERNS,
  GRADE_TONE_COPY,
  PENDING_COPY,
  CONFIDENCE_THRESHOLD_DEFAULT,
} from "./cat-grade-rules";

export type { CatFeatures, CatPattern, CatSex, GradeKey };

export interface CatGradeResult {
  /** DB의 card_rarity/grade 컬럼에 그대로 저장할 키. 신뢰도 미달 시 "pending". */
  rarityKey: GradeKey | "pending";
  /** 화면에 보여줄 한글 등급명 (일반/희귀/레어/레전드/판정 보류) */
  grade: string;
  /** 왜 이 등급인지 사람이 읽는 근거 문장 */
  reason: string;
  /** 감정 안전장치 카피 — "희소성이지 가치가 아님"을 보여주는 짧은 문구 */
  tone: string;
  /** 산정에 쓰인 원점수 (재현/감사용) */
  score: number;
  /** 적용된 개별 규칙 설명 목록 (디버깅/감사용) */
  matchedRules: string[];
  /** 신뢰도 미달로 보류됐는지 */
  pending: boolean;
  /** pending일 때, 지금 특징만으로 계산하면 나왔을 등급 (참고용, 확정 아님) */
  provisionalGrade?: GradeKey;
}

// AI 응답은 외부 입력이므로 필드 누락을 가정하고 안전하게 기본값을 채운다.
function normalizeFeatures(input: Partial<CatFeatures> | null | undefined): CatFeatures {
  return {
    colors: Array.isArray(input?.colors) ? input!.colors : [],
    pattern: (input?.pattern as CatPattern) ?? "solid",
    traits: Array.isArray(input?.traits) ? input!.traits : [],
    sex: input?.sex ?? "unknown",
    confidence: typeof input?.confidence === "number" ? input!.confidence : 0,
  };
}

function gradeKeyForScore(score: number): GradeKey {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.key;
  }
  return "common"; // 이론상 도달 안 함 (최저 구간 min:0 이 항상 걸림) — 방어적 기본값
}

function labelForGradeKey(key: GradeKey): string {
  return GRADE_THRESHOLDS.find(t => t.key === key)?.label ?? "일반";
}

/**
 * 고양이 특징(AI 개체인식 결과)을 룰 테이블에 대입해 카드 등급을 산정한다.
 * 랜덤 요소 없음 — 같은 features를 넣으면 항상 같은 결과가 나온다(순수 함수).
 */
export function calculateCatGrade(
  rawFeatures: Partial<CatFeatures> | null | undefined,
  opts?: { confidenceThreshold?: number },
): CatGradeResult {
  const features = normalizeFeatures(rawFeatures);
  const confidenceThreshold = opts?.confidenceThreshold ?? CONFIDENCE_THRESHOLD_DEFAULT;

  let score = 0;
  const matchedRules: string[] = [];

  // 1) 무늬 기본 점수
  const patternRule = PATTERN_SCORES[features.pattern];
  if (patternRule) {
    score += patternRule.score;
    if (patternRule.score > 0) matchedRules.push(patternRule.note);
  }

  // 2) 형질 점수 (중복 태그는 한 번만 반영)
  for (const trait of new Set(features.traits)) {
    const rule = TRAIT_SCORES[trait];
    if (rule) {
      score += rule.score;
      matchedRules.push(rule.note);
    }
  }

  // 3) 색상 보너스 (중복 색상은 한 번만 반영)
  for (const color of new Set(features.colors)) {
    const rule = COLOR_SCORES[color];
    if (rule) {
      score += rule.score;
      matchedRules.push(rule.note);
    }
  }

  // 4) 삼색/토터셔 + 수컷 — 유전적으로 극히 드문 조합 (핵심 규칙, 별도 가산)
  if (features.sex === "male" && MALE_PARTICOLOR_PATTERNS.includes(features.pattern)) {
    score += MALE_PARTICOLOR_BONUS;
    matchedRules.push(
      "삼색/토터셔 무늬 + 수컷 — 정상적으로 암컷(XX)에서만 발현되는 조합이라 " +
      "수컷은 성염색체 이상(XXY 등)이 있어야 함 (약 1/3,000 수준, 유전적으로 극히 드묾)",
    );
  }

  const computedGradeKey = gradeKeyForScore(score);

  // 5) 신뢰도 미달 → 등급 확정 보류. 계산 자체는 그대로 두고(재현 가능),
  //    확정만 미루는 방식 — 나중에 더 선명한 사진으로 재판정하면 그대로 이 함수를 다시 호출하면 된다.
  if (features.confidence < confidenceThreshold) {
    return {
      rarityKey: "pending",
      grade: "판정 보류",
      reason: `AI 인식 신뢰도가 낮아(${Math.round(features.confidence * 100)}%) 등급을 확정하지 않았어요.`,
      tone: PENDING_COPY,
      score,
      matchedRules,
      pending: true,
      provisionalGrade: computedGradeKey,
    };
  }

  const reason = matchedRules.length > 0
    ? matchedRules.join(" · ")
    : (patternRule?.note ?? "표준적인 무늬로 분류") + " — 특별히 희귀한 형질은 발견되지 않았어요.";

  return {
    rarityKey: computedGradeKey,
    grade: labelForGradeKey(computedGradeKey),
    reason,
    tone: GRADE_TONE_COPY[computedGradeKey],
    score,
    matchedRules,
    pending: false,
  };
}
