"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Crown, Clock } from "lucide-react";
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
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: "#FFFFFF", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
      >
        <div className="h-20 animate-pulse bg-surface-alt rounded-xl" />
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
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#48A59E" }} />
        <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
          내 활동 대시보드
        </h2>
        <span className="text-[10px] text-text-light ml-auto">
          누적 {data.totalAllTime.toLocaleString()}건
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
      >
        {/* 이번 달 카운트 + 변동률 */}
        <div
          className="px-4 py-4 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #48A59E15 0%, #48A59E05 100%)",
            borderBottom: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "#48A59E", boxShadow: "0 4px 12px #48A59E55" }}
          >
            <TrendingUp size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-text-sub">이번 달 돌봄</p>
            <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#48A59E" }}>
              {data.thisMonthCount.toLocaleString()}번
            </p>
          </div>
          {deltaPct !== null && (
            <div
              className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold shrink-0"
              style={{
                background: delta >= 0 ? "#E8F4F1" : "#FDECEC",
                color: delta >= 0 ? "#2F7B73" : "#B84545",
              }}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}%
              <span className="ml-0.5 opacity-70">vs 지난달</span>
            </div>
          )}
          {deltaPct === null && data.lastMonthCount === 0 && data.thisMonthCount > 0 && (
            <div
              className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold shrink-0"
              style={{ background: "#FFF4DC", color: "#A67B1E" }}
            >
              🎉 첫 달
            </div>
          )}
        </div>

        {/* 최다 돌본 고양이 */}
        {data.topCats.length > 0 && (
          <div className="px-4 py-3 border-b border-divider">
            <div className="flex items-center gap-1.5 mb-2">
              <Crown size={12} style={{ color: "#E8B040" }} />
              <span className="text-[11px] font-bold text-text-sub">
                가장 많이 돌본 아이
              </span>
            </div>
            <div className="flex gap-2">
              {data.topCats.map((c, i) => (
                <Link
                  key={c.catId}
                  href={`/cats/${c.catId}`}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-xl active:scale-95"
                  style={{
                    background: i === 0 ? "#FFF9EB" : "#F7F4EE",
                    border: i === 0 ? "1px solid #E8B04040" : "1px solid rgba(0,0,0,0.03)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full overflow-hidden shrink-0"
                    style={{ background: "#EEE8E0" }}
                  >
                    {c.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photoUrl} alt={c.catName} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-extrabold text-text-main truncate">
                      {i === 0 && "🥇 "}{c.catName}
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: i === 0 ? "#A67B1E" : "#A38E7A" }}>
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
                <Clock size={12} style={{ color: "#8B65B8" }} />
                <span className="text-[11px] font-bold text-text-sub">주 활동 시간대</span>
              </div>
              <span className="text-[11px] font-extrabold" style={{ color: "#8B65B8" }}>
                {peakLabel}
              </span>
            </div>
            {/* 24시간 분포 바 (4시간 단위 6구간) */}
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
                        ? "linear-gradient(180deg, #8B65B8 0%, #6E4EA0 100%)"
                        : count > 0
                          ? "#8B65B835"
                          : "rgba(0,0,0,0.04)",
                    }}
                    title={`${hour}시: ${count}번`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[8.5px] text-text-light mt-1 px-0.5 font-semibold">
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
              <span className="text-[11px] font-bold text-text-sub">
                주로 하는 돌봄
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {topTypes.map(([type, count], i) => {
                const config = CARE_TYPE_MAP[type];
                return (
                  <div
                    key={type}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1"
                    style={{
                      background: i === 0 ? config.color : `${config.color}15`,
                      color: i === 0 ? "#fff" : config.color,
                    }}
                  >
                    <span>{config.emoji}</span>
                    <span>{config.label}</span>
                    <span className="opacity-75">{count}</span>
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
