"use client";

// 위치 변경 이력 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 어두운 헤더·요약 카드 → 헤어라인 섹션 + 수치 행, 로그 카드 → 구분선 리스트. 색은 토큰만.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, User } from "lucide-react";
import {
  listRecentLocationChanges,
  type CatLocationHistoryRow,
} from "@/lib/cat-location-history-repo";
import { AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, StatRow } from "../_ui";

function formatDistance(m: number | null): string {
  if (m === null || m === undefined) return "-";
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)}km`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return d.toLocaleDateString("ko-KR");
}

export default function LocationLogsPage() {
  const [rows, setRows] = useState<CatLocationHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await listRecentLocationChanges(200);
        setRows(list);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "조회 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 동 변경 없이 좌표만 바뀐 경우와, 아예 동을 옮긴 경우 구분
  const dongMoves = rows.filter(
    (r) => (r.old_region ?? "") !== (r.new_region ?? ""),
  );
  const longMoves = rows.filter((r) => (r.distance_m ?? 0) >= 500);

  return (
    <AdminPage>
      <AdminHeader title="위치 변경 이력" description="고양이 좌표 변경 로그 · 어뷰징 감지용" />

      <AdminSection title="요약" padding={false}>
        <StatRow label="전체" value={rows.length.toLocaleString()} />
        <StatRow label="동 이동" value={dongMoves.length.toLocaleString()} />
        <StatRow
          label="500m 이상 이동"
          value={longMoves.length.toLocaleString()}
          tone={longMoves.length > 0 ? "error" : "neutral"}
        />
      </AdminSection>

      <AdminSection title="최근 변경" padding={false}>
        {loading ? (
          <AdminLoading />
        ) : err ? (
          <p className="px-4 py-3 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>
            {err}
          </p>
        ) : rows.length === 0 ? (
          <EmptyState>아직 위치 변경 기록이 없어요.</EmptyState>
        ) : (
          rows.map((r) => {
            const dongChanged = (r.old_region ?? "") !== (r.new_region ?? "");
            const far = (r.distance_m ?? 0) >= 500;
            return (
              <div key={r.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Link
                    href={`/cats/${r.cat_id}`}
                    className="text-[15px] font-semibold text-text-main truncate press"
                  >
                    {r.cat_name ?? "(삭제된 고양이)"}
                  </Link>
                  <span className="text-[11px] text-text-light shrink-0">{formatTime(r.created_at)}</span>
                </div>

                <div className="flex items-center gap-1.5 text-[13px] mb-1.5">
                  <AdminTag>{r.old_region ?? "?"}</AdminTag>
                  <ArrowRight size={13} className="text-text-light" />
                  <AdminTag tone={dongChanged ? "primary" : "neutral"}>{r.new_region ?? "?"}</AdminTag>
                  <span
                    className="ml-auto text-[13px] font-semibold tabular-nums"
                    style={{ color: far ? "var(--color-error)" : "var(--color-text-sub)" }}
                  >
                    {formatDistance(r.distance_m)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[13px] text-text-sub">
                  <User size={12} className="text-text-light" />
                  {r.changed_by ? (
                    <Link href={`/users/${r.changed_by}`} className="font-semibold press">
                      {r.changed_by_name ?? "(삭제된 유저)"}
                    </Link>
                  ) : (
                    <span>(기록 없음)</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </AdminSection>
    </AdminPage>
  );
}
