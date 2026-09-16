"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Clock } from "lucide-react";
import { catArtWalkSvg } from "@/lib/cat-art";
import {
  getMyCareDashboard,
  CARE_TYPE_MAP,
  type MyCareDashboard,
  type CareType,
} from "@/lib/care-logs-repo";

function formatHourBand(hour: number): string {
  if (hour < 5) return "새벽";
  if (hour < 9) return "아침";
  if (hour < 12) return "오전";
  if (hour < 14) return "점심";
  if (hour < 18) return "오후";
  if (hour < 22) return "저녁";
  return "밤";
}

export default function MyActivityDashboard() {
  const [data, setData] = useState<MyCareDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyCareDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="card p-4 mb-5">
        <div className="h-20 animate-pulse bg-surface-alt rounded-lg" />
      </div>
    );
  }

  // 돌봄 기록이 아예 없으면 대시보드 숨김
  if (data.totalAllTime === 0) return null;

  // 변동률
  const delta = data.thisMonthCount - data.lastMonthCount;
  const deltaPct =
    data.lastMonthCount > 0
      ? Math.round((delta / data.lastMonthCount) * 100)
      : null;

  // 최빈 시간대 라벨
  const peakLabel = data.peakHour === null
    ? null
    : `${formatHourBand(data.peakHour)} (${data.peakHour}시경)`;

  // byHour 최대값으로 정규화 (바 높이)
  const maxHourCount = Math.max(1, ...data.byHour);

  // 돌봄 유형 TOP 3
  const typesSorted = (
    Object.entries(data.byType) as [CareType, number][]
  ).sort((a, b) => b[1] - a[1]);
  const topTypes = typesSorted.slice(0, 3);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-[17px] font-bold text-text-main">
          내 활동 대시보드
        </h2>
        <span className="text-[13px] text-text-light ml-auto">
          누적 {data.totalAllTime.toLocaleString()}건
        </span>
      </div>

      <div className="card overflow-hidden">
        {/* 이번 달 카운트 + 변동률 */}
        <div
          className="px-4 py-4 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--color-divider)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-text-sub">이번 달 돌봄</p>
            <p className="text-[24px] font-bold text-text-main leading-tight">
              {data.thisMonthCount.toLocaleString()}번
            </p>
          </div>
          {deltaPct !== null && (
            <div
              className="px-2 py-1 text-[11px] font-semibold shrink-0"
              style={{
                borderRadius: "var(--radius-square)",
                background: "var(--color-gray-100)",
                color: delta >= 0 ? "var(--color-sage)" : "var(--color-error)",
              }}
            >
              {delta >= 0 ? "+" : "-"}{Math.abs(deltaPct)}%
              <span className="ml-0.5 text-text-light">지난달 대비</span>
            </div>
          )}
          {deltaPct === null && data.lastMonthCount === 0 && data.thisMonthCount > 0 && (
            <div
              className="px-2 py-1 text-[11px] font-semibold shrink-0 text-text-sub"
              style={{ borderRadius: "var(--radius-square)", background: "var(--color-gray-100)" }}
            >
              첫 달
            </div>
          )}
        </div>

        {/* 최다 돌본 고양이 */}
        {data.topCats.length > 0 && (
          <div className="px-4 py-3 border-b border-divider">
            <div className="flex items-center gap-1.5 mb-2">
              <Crown size={14} className="text-text-light" />
              <span className="text-[13px] font-semibold text-text-sub">
                가장 많이 돌본 아이
              </span>
            </div>
            <div className="flex gap-2">
              {data.topCats.map((c) => (
                <Link
                  key={c.catId}
                  href={`/cats/${c.catId}`}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 press-strong"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-card-sm)",
                  }}
                >
                  <div
                    className="relative w-8 h-8 rounded-full overflow-hidden shrink-0"
                    style={{ background: "var(--color-gray-100)" }}
                  >
                    {c.photoUrl ? (
                      <Image src={c.photoUrl} alt={c.catName} fill sizes="32px" style={{ objectFit: "cover" }} />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        aria-hidden
                        dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.catId, 26) }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-text-main truncate">
                      {c.catName}
                    </p>
                    <p className="text-[11px] text-text-light">
                      {c.count}번
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 주 활동 시간대 */}
        {peakLabel && (
          <div className="px-4 py-3 border-b border-divider">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-text-light" />
                <span className="text-[13px] font-semibold text-text-sub">주 활동 시간대</span>
              </div>
              <span className="text-[13px] font-semibold text-text-main">
                {peakLabel}
              </span>
            </div>
            {/* 24시간 분포 바 */}
            <div className="flex items-end gap-[2px] h-8">
              {data.byHour.map((count, hour) => {
                const isPeak = hour === data.peakHour;
                const h = Math.max(4, Math.round((count / maxHourCount) * 32));
                return (
                  <div
                    key={hour}
                    className="flex-1 rounded-t-[2px]"
                    style={{
                      height: h,
                      background: isPeak
                        ? "var(--color-primary)"
                        : count > 0
                          ? "var(--color-gray-300)"
                          : "var(--color-gray-100)",
                    }}
                    title={`${hour}시: ${count}번`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-text-light mt-1 px-0.5">
              <span>0시</span>
              <span>6시</span>
              <span>12시</span>
              <span>18시</span>
              <span>23시</span>
            </div>
          </div>
        )}

        {/* 돌봄 유형 TOP 3 */}
        {topTypes.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[13px] font-semibold text-text-sub">
                주로 하는 돌봄
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {topTypes.map(([type, count]) => {
                const config = CARE_TYPE_MAP[type];
                return (
                  <div
                    key={type}
                    className="px-2.5 h-8 text-[13px] font-medium flex items-center gap-1 text-text-sub"
                    style={{
                      borderRadius: "var(--radius-square)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                  >
                    <span>{config.label}</span>
                    <span className="text-text-light">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
