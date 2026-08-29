// ══════════════════════════════════════════
// 돌봄 활동 확인서 — 한 고양이의 care_logs 전체를 증빙 문서용으로 집계
// 민원 대응·지자체 협의·동물보호법 신고 시 첨부할 수 있는 자료.
// RLS가 비밀글(is_private)을 걸러주므로 여기서 추가 필터는 걸지 않는다.
// 좌표는 절대 포함하지 않는다 — region 문자열만 (좌표 퍼징 보안계약).
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { CareType } from "@/lib/care-logs-repo";

export interface CareReportRow {
  id: string;
  care_type: CareType;
  memo: string | null;
  photo_url: string | null;
  amount: string | null;
  author_name: string | null;
  logged_at: string;
}

export interface CareReport {
  totalCount: number;              // 집계된 기록 수 (최대 1000건)
  firstLoggedAt: string | null;
  lastLoggedAt: string | null;
  activeDays: number;              // 기록이 있는 고유 날짜 수 (KST)
  spanDays: number;                // 첫 기록 ~ 마지막 기록 경과 일수 (당일 = 1)
  caretakers: { name: string; count: number }[]; // 기록 수 내림차순, 최대 10명
  caretakerCount: number;          // 참여 시민 전체 수
  byType: Partial<Record<CareType, number>>;
  byMonth: { ym: string; count: number }[]; // "2026-08" — 오래된 달부터
  photoCount: number;              // 사진이 첨부된 기록 수
  rows: CareReportRow[];           // 최신순 상세 (최대 100건)
}

const kstDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

// KST 달력일 기준 경과 일수 (같은 날 = 1). 원시 ms 차이로 세면 "8/9 저녁~8/10 오후"가
// 1일로 나와 활동 일수(2일)와 모순된다 — 날짜 문자열 차이로 계산.
const kstSpanDays = (firstIso: string, lastIso: string) =>
  Math.round(
    (Date.parse(kstDay(lastIso)) - Date.parse(kstDay(firstIso))) / (24 * 60 * 60 * 1000),
  ) + 1;

// ── 유저 단위: 내 돌봄 활동 확인서 (봉사 증빙·B2G·민원 대응용) ──
export interface MyCareReport {
  totalCount: number;
  firstLoggedAt: string | null;
  lastLoggedAt: string | null;
  activeDays: number;
  spanDays: number;
  byType: Partial<Record<CareType, number>>;
  byMonth: { ym: string; count: number }[];
  byCat: { catId: string; catName: string; region: string | null; count: number }[];
  photoCount: number;
  rows: (CareReportRow & { catName: string })[]; // 최신순 상세 (최대 100건)
}

export async function getMyCareReportServer(userId: string): Promise<MyCareReport> {
  const empty: MyCareReport = {
    totalCount: 0,
    firstLoggedAt: null,
    lastLoggedAt: null,
    activeDays: 0,
    spanDays: 0,
    byType: {},
    byMonth: [],
    byCat: [],
    photoCount: 0,
    rows: [],
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_logs")
    .select("id, cat_id, care_type, memo, photo_url, amount, author_name, logged_at")
    .eq("author_id", userId)
    .order("logged_at", { ascending: false })
    .limit(1000);

  if (error || !data || data.length === 0) {
    if (error) console.error("[care-report] getMyCareReportServer failed:", error);
    return empty;
  }

  const rows = data as (CareReportRow & { cat_id: string })[];

  const dayKeys = new Set<string>();
  const byType: Partial<Record<CareType, number>> = {};
  const byMonthMap = new Map<string, number>();
  const byCatMap = new Map<string, number>();
  let photoCount = 0;

  for (const r of rows) {
    const day = kstDay(r.logged_at);
    dayKeys.add(day);
    byType[r.care_type] = (byType[r.care_type] ?? 0) + 1;
    byMonthMap.set(day.slice(0, 7), (byMonthMap.get(day.slice(0, 7)) ?? 0) + 1);
    byCatMap.set(r.cat_id, (byCatMap.get(r.cat_id) ?? 0) + 1);
    if (r.photo_url) photoCount += 1;
  }

  // 고양이 이름·지역 조회
  const catIds = Array.from(byCatMap.keys());
  const { data: cats } = await supabase
    .from("cats")
    .select("id, name, region")
    .in("id", catIds.slice(0, 100));
  const catInfo = new Map(
    ((cats ?? []) as { id: string; name: string; region: string | null }[]).map((c) => [c.id, c]),
  );

  const lastLoggedAt = rows[0].logged_at;
  const firstLoggedAt = rows[rows.length - 1].logged_at;
  const spanDays = kstSpanDays(firstLoggedAt, lastLoggedAt);

  const byCat = Array.from(byCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([catId, count]) => ({
      catId,
      catName: catInfo.get(catId)?.name ?? "(삭제된 고양이)",
      region: catInfo.get(catId)?.region ?? null,
      count,
    }));

  const byMonth = Array.from(byMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, count]) => ({ ym, count }));

  return {
    totalCount: rows.length,
    firstLoggedAt,
    lastLoggedAt,
    activeDays: dayKeys.size,
    spanDays,
    byType,
    byMonth,
    byCat,
    photoCount,
    rows: rows.slice(0, 100).map(({ cat_id, ...rest }) => ({
      ...rest,
      catName: catInfo.get(cat_id)?.name ?? "—",
    })),
  };
}

export async function getCareReportServer(catId: string): Promise<CareReport> {
  const empty: CareReport = {
    totalCount: 0,
    firstLoggedAt: null,
    lastLoggedAt: null,
    activeDays: 0,
    spanDays: 0,
    caretakers: [],
    caretakerCount: 0,
    byType: {},
    byMonth: [],
    photoCount: 0,
    rows: [],
  };
  if (!/^[0-9a-fA-F-]{32,36}$/.test(catId)) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_logs")
    .select("id, care_type, memo, photo_url, amount, author_id, author_name, logged_at")
    .eq("cat_id", catId)
    .order("logged_at", { ascending: false })
    .limit(1000);

  if (error || !data || data.length === 0) {
    if (error) console.error("[care-report] getCareReportServer failed:", error);
    return empty;
  }

  const rows = data as (CareReportRow & { author_id: string | null })[];

  const dayKeys = new Set<string>();
  const byType: Partial<Record<CareType, number>> = {};
  const byMonthMap = new Map<string, number>();
  const byAuthor = new Map<string, { name: string; count: number }>();
  let photoCount = 0;

  for (const r of rows) {
    const day = kstDay(r.logged_at);
    dayKeys.add(day);
    byType[r.care_type] = (byType[r.care_type] ?? 0) + 1;
    const ym = day.slice(0, 7);
    byMonthMap.set(ym, (byMonthMap.get(ym) ?? 0) + 1);
    if (r.photo_url) photoCount += 1;
    const key = r.author_id ?? r.author_name ?? "익명";
    const cur = byAuthor.get(key);
    if (cur) cur.count += 1;
    else byAuthor.set(key, { name: r.author_name ?? "익명", count: 1 });
  }

  // rows는 최신순 → 마지막 원소가 가장 오래된 기록
  const lastLoggedAt = rows[0].logged_at;
  const firstLoggedAt = rows[rows.length - 1].logged_at;
  const spanDays = kstSpanDays(firstLoggedAt, lastLoggedAt);

  const caretakers = Array.from(byAuthor.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byMonth = Array.from(byMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, count]) => ({ ym, count }));

  return {
    totalCount: rows.length,
    firstLoggedAt,
    lastLoggedAt,
    activeDays: dayKeys.size,
    spanDays,
    caretakers,
    caretakerCount: byAuthor.size,
    byType,
    byMonth,
    photoCount,
    rows: rows.slice(0, 100).map(({ author_id: _a, ...rest }) => rest),
  };
}
