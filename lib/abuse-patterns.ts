// 어뷰징 텍스트 패턴 검출 — 개인정보 노출·욕설·동물 학대/위협 표현.
// 길고양이 보호 + 케어테이커 개인정보 보호 + 커뮤니티 신뢰 유지.
// location-patterns.ts와 같은 형태로 description·posts·comments·DM에 재사용.

export interface AbuseViolation {
  /** 위반 카테고리 사람 라벨 — UI 메시지용 */
  label: string;
  /** 실제 매치된 부분 문자열 (사용자에게 노출) */
  match: string;
  /** 카테고리 — 분석·로깅용 */
  category: "pii" | "profanity" | "threat";
}

// ── 개인정보 (PII) ──
const PII_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // 휴대폰: 010-1234-5678 / 010 1234 5678 / 01012345678
  { regex: /01[0-9][-\s.]?\d{3,4}[-\s.]?\d{4}/g, label: "전화번호" },
  // 일반 전화: 02-XXX-XXXX, 031-XXX-XXXX
  { regex: /(?:0\d{1,2})[-\s.]?\d{3,4}[-\s.]?\d{4}/g, label: "전화번호" },
  // 주민등록번호: 6-7 형태
  { regex: /\d{6}[-\s]?[1-4]\d{6}/g, label: "주민번호" },
  // 차량번호: 12가 3456 또는 123가 4567 (앞 2-3자리 + 한글 1 + 4자리)
  { regex: /\d{2,3}\s*[가-힣]\s*\d{4}/g, label: "차량번호" },
  // 카카오톡 ID 노출 시도 — "카톡 ID:" 또는 "kakao:" 패턴 + 식별자
  { regex: /(?:카톡|kakao)\s*[id아이디:：]+\s*[A-Za-z0-9_.-]{3,}/gi, label: "외부 연락처" },
  // 인스타·페북 핸들 노출 (외부 채널 유인 차단 — 운영 정책 위반 가능)
  { regex: /(?:@[A-Za-z0-9_.]{4,30})\s*(?:인스타|insta|페북|facebook)/gi, label: "외부 SNS 핸들" },
];

// ── 욕설·비속어 (한국어 핵심 세트, 변형 포함) ──
// 너무 광범위하면 false positive 다수. "명백 욕설"만.
const PROFANITY_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // 시발/씨발/ㅅㅂ/ㅆㅂ 변형
  { regex: /[시씨씪]\s*[발팔벌볼]|ㅅ[ㅂㅍ]|ㅆ[ㅂㅍ]/g, label: "욕설" },
  // 좆/존나/ㅈ나
  { regex: /[좆좃]\s*[같됐다나]|존\s*[나망]|ㅈ\s*ㄴ\s*[게가]/g, label: "욕설" },
  // 병신/ㅂㅅ
  { regex: /병\s*[신신]|ㅂㅅ\s*[야아이]|장애\s*인\s*새끼/g, label: "욕설" },
  // 개새끼/개새/ㄱㅅㄲ
  { regex: /개\s*새\s*[끼키낀깐]|ㄱㅅㄲ/g, label: "욕설" },
  // 미친새끼·미친놈 (단순 "미친"은 false positive 많아 제외)
  { regex: /미\s*친\s*[새놈년]/g, label: "욕설" },
  // 닥쳐
  { regex: /닥\s*[쳐치]/g, label: "공격적 표현" },
  // 꺼져
  { regex: /꺼\s*[져저]/g, label: "공격적 표현" },
];

// ── 동물 위협·학대 옹호 표현 ──
// 보호 맥락의 "학대"는 OK ("학대 방지", "학대 신고"). 직접 위협만 차단.
const THREAT_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // 살해 명시 ("죽여" + 고양이/냥/얘들)
  { regex: /(?:고양이|냥|얘들|길냥|걔들|쟤들)\s*(?:다|모두|싹|전부)?\s*죽\s*[여이]/g, label: "동물 위협" },
  // 처리/처치 같은 완곡 위협
  { regex: /(?:고양이|냥|길냥)\s*(?:다|모두|싹)?\s*(?:처리|처치)/g, label: "동물 위협" },
  // 잡아 죽이자/없애자
  { regex: /(?:고양이|냥|길냥)\s*[다모싹]*\s*(?:잡아|없애|쓸어|박멸)/g, label: "동물 위협" },
  // 독약/쥐약 + 사용 의도 표현
  { regex: /(?:독약|쥐약|살서제)\s*(?:먹|뿌|놓|쓰|풀)/g, label: "독극물 위협" },
  // 직접 폭력 표현
  { regex: /(?:발로\s*차|돌\s*던|때려\s*[죽패])\s*(?:야|자|버려|쥐|줘)/g, label: "물리 폭력" },
];

const ALL_PATTERNS = [
  ...PII_PATTERNS.map((p) => ({ ...p, category: "pii" as const })),
  ...PROFANITY_PATTERNS.map((p) => ({ ...p, category: "profanity" as const })),
  ...THREAT_PATTERNS.map((p) => ({ ...p, category: "threat" as const })),
];

/**
 * 텍스트에서 어뷰징 패턴 모두 검출.
 */
export function findAbuseViolations(text: string): AbuseViolation[] {
  if (!text || typeof text !== "string") return [];

  const violations: AbuseViolation[] = [];
  const seen = new Set<string>();

  for (const { regex, label, category } of ALL_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const key = `${category}::${label}::${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ label, match: m[0], category });
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  }
  return violations;
}

/**
 * 한 줄 한국어 메시지로 변환.
 */
export function formatAbuseMessage(violations: AbuseViolation[]): string {
  if (violations.length === 0) return "";

  const hasPii = violations.some((v) => v.category === "pii");
  const hasThreat = violations.some((v) => v.category === "threat");

  const parts = violations.map((v) => `${v.label}(${v.match})`);
  const reason = hasThreat
    ? "동물 위협·공격적 표현이 감지됐어요"
    : hasPii
    ? "개인정보가 감지됐어요"
    : "부적절한 표현이 감지됐어요";

  return `${reason}: ${parts.join(", ")}`;
}
