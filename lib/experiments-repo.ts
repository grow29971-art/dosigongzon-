// ══════════════════════════════════════════
// 동네 돌봄 실험 — 공용 타입·상수
// 데이터 접근은 전부 서버 API(/api/experiment/*) 경유라 이 파일은 순수 타입/상수만 담는다.
// (클라이언트 직접 INSERT를 막는 RLS 설계와 짝 — box/supabase_experiment_migration.sql)
// ══════════════════════════════════════════

export type ExperimentActivityType = "feed" | "water" | "clean" | "health" | "other";

export const EXPERIMENT_ACTIVITY_MAP: Record<
  ExperimentActivityType,
  { label: string; emoji: string }
> = {
  feed: { label: "급식", emoji: "🍚" },
  water: { label: "물", emoji: "💧" },
  clean: { label: "청소", emoji: "🧹" },
  health: { label: "건강 확인", emoji: "🩺" },
  other: { label: "기타", emoji: "📝" },
};

export const EXPERIMENT_ACTIVITY_TYPES = Object.keys(
  EXPERIMENT_ACTIVITY_MAP,
) as ExperimentActivityType[];

export type ExperimentStatus = "draft" | "active" | "ended";

export interface ExperimentSummary {
  experiment: {
    id: string;
    publicAreaName: string;
    startsAt: string; // YYYY-MM-DD
    endsAt: string;   // YYYY-MM-DD
    status: ExperimentStatus;
    /** KST 오늘 기준 기록 가능 여부 (기간 내 + active) */
    isOpenToday: boolean;
    /** 실험 종료까지 남은 일수 (음수면 종료) */
    daysLeft: number;
  };
  /** 지역 전체 집계 (개인 식별 없음) */
  area: {
    weekLogCount: number;      // 이번 주(월~) 돌봄 완료 횟수
    weekCarerCount: number;    // 이번 주 참여한 돌봄자 수
    streakDays: number;        // 오늘까지 연속으로 기록이 이어진 날짜 수
  };
  /** 나의 개인 기록 (지역 집계와 명확히 구분) */
  me: {
    todayTypes: ExperimentActivityType[]; // 오늘 이미 기록한 활동 유형
    weekLogCount: number;                 // 이번 주 나의 기록 수
    totalLogCount: number;                // 실험 기간 나의 누적 기록 수
  };
}

/** 초대 문구 기본안 — 초대 링크 공유·OG 설명에 공통 사용 */
export function inviteCopy(areaName: string): string {
  return `${areaName}에서 길고양이를 돌보는 분들과 2주 동안 간단한 돌봄 기록을 모아보려 해요. 위치는 공개하지 않고, 누가 얼마나 했는지 경쟁시키지도 않습니다. 우리 동네에서 돌봄이 얼마나 이어지고 있는지만 함께 확인해 보실 분을 찾습니다.`;
}
