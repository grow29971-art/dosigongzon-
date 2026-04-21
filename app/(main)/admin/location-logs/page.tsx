"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, ArrowRight, User } from "lucide-react";
import {
  listRecentLocationChanges,
  type CatLocationHistoryRow,
} from "@/lib/cat-location-history-repo";

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
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div
        className="px-5 pt-12 pb-5"
        style={{
          background: "linear-gradient(135deg, #2C2C2C 0%, #3F3F3F 100%)",
          color: "#fff",
        }}
      >
        <Link
          href="/admin"
          className="flex items-center gap-1 text-[12px] font-semibold mb-3 opacity-80 active:scale-95"
        >
          <ArrowLeft size={14} />
          관리자 홈
        </Link>
        <div className="flex items-baseline gap-2 mb-1">
          <MapPin size={20} />
          <h1 className="text-[22px] font-extrabold tracking-tight">
            위치 변경 이력
          </h1>
        </div>
        <p className="text-[12px] opacity-70">
          고양이 좌표 변경 로그 · 어뷰징 감지용
        </p>
      </div>

      {/* 요약 */}
      <div className="px-4 -mt-6 mb-5 grid grid-cols-3 gap-2">
        <SummaryCard label="전체" value={rows.length} color="#4A7BA8" />
        <SummaryCard label="동 이동" value={dongMoves.length} color="#C47E5A" />
        <SummaryCard
          label="500m↑ 이동"
          value={longMoves.length}
          color="#D85555"
        />
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center pt-10">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : err ? (
          <div
            className="rounded-2xl px-4 py-3 text-[12px] font-bold"
            style={{ background: "#FDECEC", color: "#B84545" }}
          >
            {err}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-6 text-center text-[12px] text-text-sub"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            아직 위치 변경 기록이 없어요.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const dongChanged =
                (r.old_region ?? "") !== (r.new_region ?? "");
              const far = (r.distance_m ?? 0) >= 500;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl p-3.5"
                  style={{
                    boxShadow: far
                      ? "0 2px 14px rgba(216,85,85,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.05)",
                    border: far
                      ? "1px solid rgba(216,85,85,0.25)"
                      : "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Link
                      href={`/cats/${r.cat_id}`}
                      className="text-[14px] font-extrabold text-text-main truncate active:opacity-70"
                    >
                      🐱 {r.cat_name ?? "(삭제된 고양이)"}
                    </Link>
                    <span className="text-[10px] text-text-light shrink-0 ml-2">
                      {formatTime(r.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] mb-2">
                    <span
                      className="px-2 py-1 rounded-lg font-bold"
                      style={{
                        background: "#F6F1EA",
                        color: "#A38E7A",
                      }}
                    >
                      {r.old_region ?? "?"}
                    </span>
                    <ArrowRight
                      size={13}
                      className={dongChanged ? "text-primary" : "text-text-light"}
                    />
                    <span
                      className="px-2 py-1 rounded-lg font-bold"
                      style={{
                        background: dongChanged ? "#FFF2E8" : "#F6F1EA",
                        color: dongChanged ? "#C47E5A" : "#A38E7A",
                      }}
                    >
                      {r.new_region ?? "?"}
                    </span>
                    <span
                      className="ml-auto text-[11px] font-extrabold"
                      style={{ color: far ? "#D85555" : "#666" }}
                    >
                      {formatDistance(r.distance_m)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                    <User size={11} />
                    {r.changed_by ? (
                      <Link
                        href={`/users/${r.changed_by}`}
                        className="font-semibold active:opacity-70"
                      >
                        {r.changed_by_name ?? "(삭제된 유저)"}
                      </Link>
                    ) : (
                      <span>(기록 없음)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-3 bg-white"
      style={{
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <p className="text-[10px] font-bold text-text-sub">{label}</p>
      <p
        className="text-[20px] font-extrabold tracking-tight mt-0.5"
        style={{ color }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
