// ══════════════════════════════════════════
// 동네 돌봄 실험 — 지표 계산 (순수 함수)
// DB 접근 없이 원자료 배열만 받아 계산한다. 표본이 작으므로(목표 5명) 통계적
// 유의성 주장 없이 "원자료 단순 집계"만 제공 — 화면에도 그렇게 표기할 것.
// 날짜는 전부 KST 달력 날짜 "YYYY-MM-DD" 문자열 (lib/kst.ts와 동일 규약).
// ══════════════════════════════════════════

export interface MetricMemberRow {
  user_id: string;
  invited_by: string | null;
}

export interface MetricInviteRow {
  accepted_by: string | null;
}

export interface MetricLogRow {
  user_id: string;
  cared_on: string; // YYYY-MM-DD
}

export interface ExperimentMetrics {
  memberCount: number;
  /** 초대받아 참여한 사람 수 (invited_by 존재) */
  invitedMemberCount: number;
  /** 초대받은 참여자 중 첫 돌봄 기록을 남긴 수/비율 */
  invitedWithFirstLog: number;
  invitedFirstLogRate: number | null; // 분모 0이면 null
  /** 첫 기록자 수와, 첫 기록 후 다음 7일 구간(D+1~D+7)에도 기록한 수/비율 */
  firstLoggerCount: number;
  firstLoggerRetained: number;
  firstLoggerRetentionRate: number | null;
  /** 사용자별 주간 평균 기록 수 (총 기록 / 기록자 수 / 경과 주수) */
  weeklyAvgLogsPerUser: number | null;
  /** 초대 링크 생성 수 / 수락 수 */
  inviteCreatedCount: number;
  inviteAcceptedCount: number;
  /** 주차별(시작일 기준 7일 버킷) 반복 기록자 수 — 한 주에 서로 다른 2일 이상 기록 */
  weeklyRepeatCarers: { week: number; repeatCarers: number; activeCarers: number; logCount: number }[];
}

/** "YYYY-MM-DD" 간 일수 차 (b - a) */
export function dayDiff(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 오늘까지 연속으로 기록이 이어진 날짜 수 (지역 전체 기준).
 * 오늘 기록이 없으면 어제까지의 연속을 반환 — "아직 오늘이 안 끝났는데 0으로
 * 리셋돼 보이는" 실망 방지. 실험 시작일 이전으로는 세지 않는다.
 */
export function computeStreakDays(
  loggedDays: ReadonlySet<string>,
  today: string,
  startsAt: string,
): number {
  let cursor = loggedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (loggedDays.has(cursor) && dayDiff(startsAt, cursor) >= 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function computeExperimentMetrics(input: {
  members: MetricMemberRow[];
  invites: MetricInviteRow[];
  logs: MetricLogRow[];
  startsAt: string;
  endsAt: string;
  today: string;
}): ExperimentMetrics {
  const { members, invites, logs, startsAt, endsAt, today } = input;

  // 사용자별 기록 날짜 집합 (중복 제출은 DB unique로 막지만 방어적으로 dedupe)
  const daysByUser = new Map<string, Set<string>>();
  for (const log of logs) {
    let set = daysByUser.get(log.user_id);
    if (!set) daysByUser.set(log.user_id, (set = new Set()));
    set.add(log.cared_on);
  }

  // ── 초대받은 사람의 첫 기록 전환율 ──
  const invitedMembers = members.filter((m) => m.invited_by !== null);
  const invitedWithFirstLog = invitedMembers.filter(
    (m) => (daysByUser.get(m.user_id)?.size ?? 0) > 0,
  ).length;

  // ── 첫 기록자의 다음 7일 재기록률 ──
  let firstLoggerCount = 0;
  let firstLoggerRetained = 0;
  for (const days of daysByUser.values()) {
    const sorted = [...days].sort();
    const first = sorted[0];
    firstLoggerCount += 1;
    // 다음 7일 구간이 아직 오지 않은(첫 기록이 최근 7일 이내) 사용자는 판정 불가지만
    // 소표본 단순 집계 원칙에 따라 분모에 포함하고 화면에 주석으로 표기한다.
    const retained = sorted.some(
      (d) => dayDiff(first, d) >= 1 && dayDiff(first, d) <= 7,
    );
    if (retained) firstLoggerRetained += 1;
  }

  // ── 사용자별 주간 평균 기록 수 ──
  const effectiveEnd = dayDiff(today, endsAt) >= 0 ? today : endsAt;
  const elapsedDays = Math.max(1, dayDiff(startsAt, effectiveEnd) + 1);
  const elapsedWeeks = Math.max(1, Math.ceil(elapsedDays / 7));
  const loggerCount = daysByUser.size;
  const weeklyAvgLogsPerUser =
    loggerCount === 0 ? null : logs.length / loggerCount / elapsedWeeks;

  // ── 주차별 반복 기록자 수 ──
  const totalWeeks = Math.max(1, Math.ceil((dayDiff(startsAt, endsAt) + 1) / 7));
  const weeklyRepeatCarers: ExperimentMetrics["weeklyRepeatCarers"] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(startsAt, w * 7);
    const weekEnd = addDays(startsAt, w * 7 + 6);
    let repeatCarers = 0;
    let activeCarers = 0;
    let logCount = 0;
    for (const days of daysByUser.values()) {
      const inWeek = [...days].filter((d) => d >= weekStart && d <= weekEnd);
      if (inWeek.length > 0) activeCarers += 1;
      if (inWeek.length >= 2) repeatCarers += 1;
    }
    for (const log of logs) {
      if (log.cared_on >= weekStart && log.cared_on <= weekEnd) logCount += 1;
    }
    weeklyRepeatCarers.push({ week: w + 1, repeatCarers, activeCarers, logCount });
  }

  return {
    memberCount: members.length,
    invitedMemberCount: invitedMembers.length,
    invitedWithFirstLog,
    invitedFirstLogRate:
      invitedMembers.length === 0 ? null : invitedWithFirstLog / invitedMembers.length,
    firstLoggerCount,
    firstLoggerRetained,
    firstLoggerRetentionRate:
      firstLoggerCount === 0 ? null : firstLoggerRetained / firstLoggerCount,
    weeklyAvgLogsPerUser,
    inviteCreatedCount: invites.length,
    inviteAcceptedCount: invites.filter((i) => i.accepted_by !== null).length,
    weeklyRepeatCarers,
  };
}
