// 길고양이 안전을 위해 description에 적으면 안 되는 "위치 특정" 패턴.
// 정확한 좌표는 DB가 흐리게 처리하지만, description에 "X역 N번 출구"처럼
// 적으면 사실상 좌표가 공개되는 셈이라 차단함.

export interface LocationViolation {
  /** 위반 카테고리 사람 라벨 — UI 메시지용 */
  label: string;
  /** 실제로 매치된 부분 문자열 */
  match: string;
}

const PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // 지하철·기차 출구 번호 — "2번 출구", "3번출구"
  { regex: /\d+\s*번\s*출구/g, label: "출구 번호" },

  // 특정 역 이름 — 2자+ 한글 + "역" + 조사·구두점·공백·끝
  // "역삼역에서", "탑골역 앞" 등
  { regex: /[가-힣]{2,}역(?=\s|$|[,.!?·]|에|을|를|의|앞|뒤|옆|근처|쪽)/g, label: "지하철역 이름" },

  // 특정 시장 — "남대문시장", "통인시장"
  { regex: /[가-힣]{2,}시장/g, label: "시장 이름" },

  // 특정 공원 — "탑골공원", "올림픽공원", "어린이공원"
  { regex: /[가-힣]{2,}공원/g, label: "공원 이름" },

  // 특정 아파트·빌라·오피스텔 — "래미안", "X아파트"
  { regex: /[가-힣]{2,}아파트/g, label: "아파트 이름" },
  { regex: /[가-힣]{2,}오피스텔/g, label: "오피스텔 이름" },

  // 단지 번호 — "101단지", "3단지"
  { regex: /\d+\s*단지/g, label: "단지 번호" },

  // 동·호수 — "103동 502호", "5동 301호"
  { regex: /\d+\s*동\s*\d+\s*호/g, label: "동·호수" },

  // 특정 학교
  { regex: /[가-힣]{2,}(초등학교|중학교|고등학교|대학교)/g, label: "학교 이름" },

  // 도로명 + 번지 — "OO로 N길", "OO로 N-N"
  { regex: /[가-힣]{2,}로\s*\d+[-\d]*길?/g, label: "도로 주소" },
  { regex: /\d+[-]\d+\s*번지/g, label: "번지 주소" },

  // 백화점·마트
  { regex: /[가-힣]{2,}백화점/g, label: "백화점 이름" },
  { regex: /[가-힣]{2,}마트/g, label: "마트 이름" },
];

/**
 * description 문자열에서 위치 특정 패턴을 모두 찾는다.
 * 매치 0건이면 빈 배열.
 */
export function findLocationViolations(text: string): LocationViolation[] {
  if (!text || typeof text !== "string") return [];

  const violations: LocationViolation[] = [];
  const seen = new Set<string>();

  for (const { regex, label } of PATTERNS) {
    // /g 플래그라 lastIndex 리셋 필요
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const key = `${label}::${m[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({ label, match: m[0] });
      // 무한 루프 방지 (zero-width match)
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  }
  return violations;
}

/**
 * 검증 결과를 사용자에게 보여줄 한 줄 메시지로 변환.
 * 예: "지하철역 이름(역삼역), 출구 번호(2번 출구)는 길고양이 안전을 위해 적을 수 없어요."
 */
export function formatViolationMessage(violations: LocationViolation[]): string {
  if (violations.length === 0) return "";
  const parts = violations.map((v) => `${v.label}(${v.match})`);
  return `${parts.join(", ")}는 길고양이 안전을 위해 적을 수 없어요.`;
}
