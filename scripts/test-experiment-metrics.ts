// 동네 돌봄 실험 — 지표 계산 순수 함수 검증
// 실행: npx --yes tsx scripts/test-experiment-metrics.ts
// (레포에 테스트 러너가 없어 단독 스크립트로 유지 — DB 없이 순수 함수만 검증)

import assert from "node:assert/strict";
import {
  addDays, dayDiff, computeStreakDays, computeExperimentMetrics,
} from "../lib/experiment-metrics";

// ── 날짜 헬퍼 ──
assert.equal(dayDiff("2026-07-01", "2026-07-14"), 13);
assert.equal(dayDiff("2026-07-14", "2026-07-01"), -13);
assert.equal(addDays("2026-07-31", 1), "2026-08-01");
assert.equal(addDays("2026-07-01", -1), "2026-06-30");

// ── 연속 기록일 ──
{
  const days = new Set(["2026-07-01", "2026-07-02", "2026-07-03"]);
  // 오늘 기록 있음 → 3일 연속
  assert.equal(computeStreakDays(days, "2026-07-03", "2026-07-01"), 3);
  // 오늘 기록 없음 → 어제까지의 연속 유지 (실망 방지 규칙)
  assert.equal(computeStreakDays(days, "2026-07-04", "2026-07-01"), 3);
  // 하루 건너뜀 → 끊김
  assert.equal(computeStreakDays(days, "2026-07-05", "2026-07-01"), 0);
  // 실험 시작일 이전은 세지 않음
  assert.equal(computeStreakDays(days, "2026-07-03", "2026-07-02"), 2);
  // 기록 없음
  assert.equal(computeStreakDays(new Set(), "2026-07-03", "2026-07-01"), 0);
}

// ── 종합 지표 (합성 14일 실험) ──
{
  const startsAt = "2026-07-01";
  const endsAt = "2026-07-14";
  const metrics = computeExperimentMetrics({
    startsAt,
    endsAt,
    today: "2026-07-14",
    members: [
      { user_id: "A", invited_by: null },  // 시작 멤버 (관리자)
      { user_id: "B", invited_by: "A" },   // 초대받아 참여 + 기록함
      { user_id: "C", invited_by: "A" },   // 초대받아 참여 + 기록 안 함
    ],
    invites: [
      { accepted_by: "B" },
      { accepted_by: "C" },
      { accepted_by: null }, // 미사용 링크
    ],
    logs: [
      { user_id: "A", cared_on: "2026-07-01" },
      { user_id: "A", cared_on: "2026-07-02" },
      { user_id: "A", cared_on: "2026-07-03" },
      { user_id: "A", cared_on: "2026-07-08" }, // 2주차
      { user_id: "B", cared_on: "2026-07-02" }, // 첫 기록 후 재기록 없음
    ],
  });

  assert.equal(metrics.memberCount, 3);
  assert.equal(metrics.invitedMemberCount, 2);
  // 초대받은 사람(B, C) 중 첫 기록 남긴 사람은 B뿐 → 50%
  assert.equal(metrics.invitedWithFirstLog, 1);
  assert.equal(metrics.invitedFirstLogRate, 0.5);
  // 첫 기록자 A(7/1)·B(7/2) 중 다음 7일 내 재기록은 A만 → 50%
  assert.equal(metrics.firstLoggerCount, 2);
  assert.equal(metrics.firstLoggerRetained, 1);
  assert.equal(metrics.firstLoggerRetentionRate, 0.5);
  // 총 5건 / 기록자 2명 / 경과 2주 = 1.25
  assert.equal(metrics.weeklyAvgLogsPerUser, 1.25);
  assert.equal(metrics.inviteCreatedCount, 3);
  assert.equal(metrics.inviteAcceptedCount, 2);
  // 1주차: A 3일(반복), B 1일 → 반복 1 / 활동 2 / 기록 4
  assert.deepEqual(metrics.weeklyRepeatCarers[0], { week: 1, repeatCarers: 1, activeCarers: 2, logCount: 4 });
  // 2주차: A 1일 → 반복 0 / 활동 1 / 기록 1
  assert.deepEqual(metrics.weeklyRepeatCarers[1], { week: 2, repeatCarers: 0, activeCarers: 1, logCount: 1 });
}

// ── 빈 데이터 (0으로 나누기 방어) ──
{
  const metrics = computeExperimentMetrics({
    startsAt: "2026-07-01",
    endsAt: "2026-07-14",
    today: "2026-07-01",
    members: [],
    invites: [],
    logs: [],
  });
  assert.equal(metrics.invitedFirstLogRate, null);
  assert.equal(metrics.firstLoggerRetentionRate, null);
  assert.equal(metrics.weeklyAvgLogsPerUser, null);
}

// ── 실험 진행 중(오늘이 종료 전)일 때 경과 주수 ──
{
  const metrics = computeExperimentMetrics({
    startsAt: "2026-07-01",
    endsAt: "2026-07-14",
    today: "2026-07-05", // 5일 경과 → 1주로 계산
    members: [{ user_id: "A", invited_by: null }],
    invites: [],
    logs: [
      { user_id: "A", cared_on: "2026-07-01" },
      { user_id: "A", cared_on: "2026-07-03" },
    ],
  });
  assert.equal(metrics.weeklyAvgLogsPerUser, 2);
}

console.log("✅ experiment-metrics: 모든 검증 통과");
