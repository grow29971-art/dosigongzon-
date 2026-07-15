// ══════════════════════════════════════════
// 도시공존 — KST(Asia/Seoul) 날짜 헬퍼 (공용)
// 15곳+에 복붙돼 있던 판본들을 통합 (2026-07-15).
// KST는 DST가 없어 "+09:00" 고정 앵커가 항상 안전하다 —
// toLocaleString("en-US") 문자열을 다시 Date로 파싱하는 기존 꼼수(구현 의존적)를 대체.
// 서버/클라이언트 어디서든 동일 결과.
// ══════════════════════════════════════════

/** 주어진 시각(기본: 지금)의 KST 달력 날짜 "YYYY-MM-DD" */
export function toKstDate(d: string | Date = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // en-CA 로케일은 "YYYY-MM-DD" 포맷을 반환
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 오늘(KST) "YYYY-MM-DD" */
export function kstToday(): string {
  return toKstDate(new Date());
}

/** 오늘 KST 자정(00:00)의 UTC ISO 문자열 — DB timestamptz 비교용 */
export function kstTodayStartIso(): string {
  return new Date(kstToday() + "T00:00:00+09:00").toISOString();
}

/** 이번 주 월요일(KST)의 달력 날짜 "YYYY-MM-DD" */
export function thisMondayKstDate(): string {
  const today = kstToday();
  // T00:00:00Z 앵커로 해당 달력 날짜의 요일 획득 (0=일, 1=월 …)
  const anchor = new Date(today + "T00:00:00Z");
  const daysSinceMonday = (anchor.getUTCDay() + 6) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - daysSinceMonday);
  return anchor.toISOString().slice(0, 10);
}

/** 이번 주 월요일 0시(KST)의 UTC ISO 문자열 — 주간 집계 경계용 */
export function thisMondayKstISO(): string {
  return new Date(thisMondayKstDate() + "T00:00:00+09:00").toISOString();
}
