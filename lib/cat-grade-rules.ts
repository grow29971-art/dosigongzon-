// 고양이 카드 등급 산정 — 룰 테이블 (config)
//
// 이 파일은 "규칙"만 담는다. 판정 로직은 lib/cat-grade.ts 에 있다.
// AI 개체인식 모듈은 특징(색/무늬/형질/성별)만 추출하고, 등급은 이 테이블 값을
// 그대로 더해서 나온다 — AI가 등급을 직접 "판단"하지 않는다. 그래야
//   1) 왜 이 등급인지 사람이 룰 코드만 보고 설명할 수 있고,
//   2) 나중에 규칙이 바뀌면(=이 파일만 고치면) 기존 카드도 같은 함수로 재산정할 수 있다.
//
// 각 항목의 점수 옆에는 "왜 이 점수인지" 근거를 주석으로 남긴다 — 감정적 논쟁이
// 생겼을 때("왜 내 애만 일반이야") 코드를 그대로 보여주고 설명할 수 있어야 하기 때문.

export type CatPattern =
  | "solid" | "tabby" | "tuxedo" | "bicolor" | "colorpoint" | "van"
  | "tortoiseshell" | "tortie" | "torbie" | "calico"
  | (string & {}); // AI가 아직 정의 안 된 무늬명을 줘도 타입 에러 없이 받되, 룰 테이블엔 없으므로 기본값(0점) 처리됨

export type CatSex = "male" | "female" | "unknown";

export interface CatFeatures {
  colors: string[];
  pattern: CatPattern;
  traits: string[];
  sex: CatSex;
  confidence: number; // 0.0 ~ 1.0 — AI 개체인식 신뢰도
}

// ── 등급 점수 구간 ──
// 점수 → 등급 매핑. 구간 경계는 아래 PATTERN/TRAIT 점수와 맞물려서 정한 것이므로,
// 점수 테이블을 바꾸면 이 구간도 같이 검토할 것.
export const GRADE_THRESHOLDS = [
  { min: 30, key: "legendary" as const, label: "레전드" },
  { min: 15, key: "rare"      as const, label: "레어" },
  { min: 5,  key: "uncommon"  as const, label: "희귀" },
  { min: 0,  key: "common"    as const, label: "일반" },
];

export type GradeKey = "common" | "uncommon" | "rare" | "legendary";

// AI 신뢰도가 이 값 미만이면 등급을 확정하지 않고 "판정 보류" 처리한다.
export const CONFIDENCE_THRESHOLD_DEFAULT = 0.6;

// ── 무늬(pattern) 기본 점수 ──
// 근거: 실제 고양이 개체군에서 관찰되는 빈도 + 사람들이 체감하는 "특별함" 정도.
// (엄밀한 유전학 통계가 아니라 "설계된 희소성" 기준 — 필요시 조정)
export const PATTERN_SCORES: Record<string, { score: number; note: string }> = {
  solid:         { score: 0,  note: "단색 — 가장 흔하게 관찰되는 무늬" },
  tabby:         { score: 0,  note: "줄무늬(태비) — 길고양이 중 가장 흔한 무늬" },
  bicolor:       { score: 4,  note: "이색(투톤) — 흔하지만 단색/태비보다는 조합이 다양함" },
  tuxedo:        { score: 5,  note: "턱시도(흑백 이색) — 알아보기 쉬운 개성 있는 배색" },
  van:           { score: 9,  note: "반(Van) 패턴 — 몸 대부분이 흰색이고 얼굴·꼬리에만 색이 남는 비교적 드문 분포" },
  colorpoint:    { score: 10, note: "포인트(샴 패턴) — 온도에 따라 색이 발현되는 특수 유전자(temperature-sensitive albinism), 길고양이 중 드묾" },
  torbie:        { score: 11, note: "토르비(태비+토터셔) — 두 무늬가 섞인 복합 배색" },
  tortoiseshell: { score: 12, note: "토터셔(이색 얼룩) — X염색체 색소 유전자 두 개가 함께 발현되는 조합" },
  tortie:        { score: 12, note: "토터셔 별칭 — tortoiseshell과 동일 근거" },
  calico:        { score: 20, note: "삼색(칼리코) — 흰색 바탕 + 두 가지 X연관 색소가 모두 발현되어야 하는 조합. 암컷에서도 비교적 뚜렷하고 눈에 띄는 배색" },
};
const DEFAULT_PATTERN_SCORE = { score: 0, note: "표준적인 무늬로 분류" };

// ── 형질(traits) 점수 ── AI가 traits 배열로 주는 임의 태그 중 "희소성에 유의미한" 것만 점수를 매긴다.
// 목록에 없는 태그(예: black_nose)는 조용히 0점 처리 — 관련 없는 태그가 섞여 와도 안전하게 무시된다.
export const TRAIT_SCORES: Record<string, { score: number; note: string }> = {
  odd_eye:    { score: 15, note: "오드아이(양안 이색증) — 홍채 색소 발현 이상으로 나타나는 뚜렷한 희귀 형질" },
  polydactyl: { score: 12, note: "다지증(발가락이 더 많음) — 흔치 않은 유전적 변이" },
  heterochromia_partial: { score: 8, note: "부분 이색 홍채 — 오드아이보다는 약하지만 눈에 띄는 색소 변이" },
};

// ── 색상(colors) 보너스 ── 배열 전체를 보고 "희귀한 색이 하나라도 포함되면" 가산.
// 낮은 가중치로 시작 — 색상만으로 등급이 크게 흔들리지 않도록 보수적으로 설정.
export const COLOR_SCORES: Record<string, { score: number; note: string }> = {
  white:  { score: 3, note: "완전 흰색 — 다른 색소가 전혀 발현되지 않은 비교적 드문 케이스" },
  cream:  { score: 2, note: "크림(희석 오렌지) — 열성 희석 유전자가 필요해 오렌지보다 드묾" },
  dilute_gray: { score: 2, note: "회색조 희석색(블루/라일락 계열) — 희석 유전자 보유 개체" },
};

// ── 삼색·토터셔 + 수컷 보너스 (핵심 규칙) ──
// 근거: 삼색/토터셔 무늬는 오렌지(O)/비오렌지 색소 유전자가 X염색체에 있어,
// 정상적으로는 X염색체 2개(암컷, XX)가 있어야 두 색이 함께 발현된다.
// 수컷(XY)이 이 무늬를 가지려면 클라인펠터 증후군(XXY) 등 성염색체 이상이 필요하며
// 실제 발생 빈도는 약 1/3,000 수준으로 알려져 있다 — "유전적으로 극히 드묾"의 근거.
export const MALE_PARTICOLOR_BONUS = 40;
export const MALE_PARTICOLOR_PATTERNS = ["calico", "tortoiseshell", "tortie", "torbie"];

// ── 등급별 "감정 안전장치" 카피 ──
// 등급 = 희소성이지 가치·사랑의 크기가 아니라는 걸 문구로 분명히 한다.
// UI에서 "왜 이 등급이에요?"에 답할 때 reason과 함께 노출하는 용도.
export const GRADE_TONE_COPY: Record<GradeKey, string> = {
  common:    "이 동네에서 가장 자주 만나는, 늘 곁을 지켜주는 든든한 아이예요.",
  uncommon:  "색과 무늬가 조금 특별한, 눈에 띄는 아이예요.",
  rare:      "흔치 않은 특징을 가진, 귀한 아이예요.",
  legendary: "유전적으로 매우 보기 드문, 우리 동네의 전설 같은 아이예요.",
};
export const PENDING_COPY =
  "아직 특징을 정확히 확인하지 못했어요. 사진을 다시 등록하면 다시 판정할 수 있어요.";
