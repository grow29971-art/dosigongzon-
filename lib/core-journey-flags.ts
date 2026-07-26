// ══════════════════════════════════════════
// 핵심 여정 개편(P1~P7) feature flag + 전체 kill switch
// 설계 원칙: box/개발일지_20260726_핵심여정개편.md §5
//
// fail-closed 계약:
//  - flag: 미설정·빈 값·해석 불가·예외 → 무조건 false(기존 동선 유지).
//    켜는 값은 "1" / "true" / "on" (대소문자·공백 무시)만 인정.
//  - kill switch: 방향이 반대다. 값이 설정되어 있는데 명시적 off
//    ("" / "0" / "false" / "off")가 아니면 오타여도 차단으로 간주.
//
// NEXT_PUBLIC_ 변수는 빌드 시 리터럴 접근만 인라인된다
// (process.env[name] 같은 동적 조회는 클라이언트에서 undefined).
// 그래서 스테이지별 읽기는 반드시 아래 switch의 정적 접근을 거친다.
//
// kill switch는 서버 전용 FF_CJ_KILL_ALL이 원본이지만, 클라이언트
// 번들은 서버 전용 변수를 볼 수 없으므로 미러 NEXT_PUBLIC_FF_CJ_KILL_ALL을
// 함께 지원한다. Vercel에서 차단 시 두 변수를 모두 설정하고 재배포할 것.
// ══════════════════════════════════════════

export const CORE_JOURNEY_STAGES = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
] as const;

export type CoreJourneyStage = (typeof CORE_JOURNEY_STAGES)[number];

/** 스테이지 → 환경변수 이름. 관리자 화면·문서 표기용 (읽기는 switch가 담당). */
export const CORE_JOURNEY_FLAG_ENV_NAMES: Record<CoreJourneyStage, string> = {
  P1: "NEXT_PUBLIC_FF_CJ_CARE_INBOX_HOME",
  P2: "NEXT_PUBLIC_FF_CJ_MAP_DISCOVERY",
  P3: "NEXT_PUBLIC_FF_CJ_CARE_SHIFT",
  P4: "NEXT_PUBLIC_FF_CJ_CARE_TEAM",
  P5: "NEXT_PUBLIC_FF_CJ_LOCATION_TRUST",
  P6: "NEXT_PUBLIC_FF_CJ_EMERGENCY_HELP",
  P7: "NEXT_PUBLIC_FF_CJ_REDUCED_EXTRAS",
};

export const KILL_SWITCH_ENV_NAME = "FF_CJ_KILL_ALL";
export const KILL_SWITCH_PUBLIC_ENV_NAME = "NEXT_PUBLIC_FF_CJ_KILL_ALL";

// 클라이언트 인라인 제약 때문에 리터럴 접근만 사용 — CORE_JOURNEY_FLAG_ENV_NAMES와
// 항상 일치해야 한다 (core-journey-flags.test.ts가 일치를 검증).
function readStageRaw(stage: CoreJourneyStage): string | undefined {
  switch (stage) {
    case "P1":
      return process.env.NEXT_PUBLIC_FF_CJ_CARE_INBOX_HOME;
    case "P2":
      return process.env.NEXT_PUBLIC_FF_CJ_MAP_DISCOVERY;
    case "P3":
      return process.env.NEXT_PUBLIC_FF_CJ_CARE_SHIFT;
    case "P4":
      return process.env.NEXT_PUBLIC_FF_CJ_CARE_TEAM;
    case "P5":
      return process.env.NEXT_PUBLIC_FF_CJ_LOCATION_TRUST;
    case "P6":
      return process.env.NEXT_PUBLIC_FF_CJ_EMERGENCY_HELP;
    case "P7":
      return process.env.NEXT_PUBLIC_FF_CJ_REDUCED_EXTRAS;
    default:
      return undefined;
  }
}

/** flag 값 해석. 명시적 on("1"/"true"/"on")만 true — 그 외 전부 false. */
export function parseFlagValue(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

/**
 * kill switch 값 해석. 미설정·명시적 off(""/"0"/"false"/"off")만 비활성 —
 * 설정돼 있는데 해석 불가(오타 포함)면 차단 쪽으로 기운다.
 */
export function parseKillSwitchValue(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false" && value !== "off";
}

/** 전체 kill switch 활성 여부. 서버 원본 + 클라이언트 미러 중 하나라도 켜지면 차단. */
export function isKillSwitchOn(): boolean {
  try {
    return (
      parseKillSwitchValue(process.env.FF_CJ_KILL_ALL) ||
      parseKillSwitchValue(process.env.NEXT_PUBLIC_FF_CJ_KILL_ALL)
    );
  } catch {
    return true; // 판독 자체가 실패하면 차단 쪽으로
  }
}

/**
 * 핵심 여정 스테이지(P1~P7) 활성 여부 — 앱 코드가 쓰는 유일한 진입점.
 * kill switch가 켜져 있으면 개별 flag와 무관하게 항상 false.
 */
export function isCoreJourneyEnabled(stage: CoreJourneyStage): boolean {
  try {
    if (isKillSwitchOn()) return false;
    return parseFlagValue(readStageRaw(stage));
  } catch {
    return false; // 어떤 예외든 기존 동선 유지
  }
}
