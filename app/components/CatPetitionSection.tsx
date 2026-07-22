"use client";

// 커뮤니티 — 국회 국민동의청원 중 길고양이 관련 청원 목록.
// /api/petitions(1시간 캐시)에서 가져와 표시. 찬반 구분 없이 전부 노출(중립).
// 동의는 국회 사이트에서 본인인증으로만 가능 — 앱은 링크 안내만 한다(2026-07-22 회의).

import { useEffect, useState } from "react";
import { Landmark, ExternalLink } from "lucide-react";
import type { CatPetition } from "@/app/api/petitions/route";

function dday(endDate: string): string {
  const end = new Date(`${endDate}T23:59:59+09:00`).getTime();
  if (Number.isNaN(end)) return "";
  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days < 0) return "마감";
  if (days === 0) return "오늘 마감";
  return `D-${days}`;
}

export default function CatPetitionSection() {
  const [petitions, setPetitions] = useState<CatPetition[]>([]);

  useEffect(() => {
    fetch("/api/petitions")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.petitions)) setPetitions(d.petitions);
      })
      .catch(() => {
        /* 국회 API 장애 — 섹션 숨김 */
      });
  }, []);

  if (petitions.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
          국회에 올라온 길고양이 청원
        </h2>
        <Landmark size={14} style={{ color: "#6B7FA3" }} />
      </div>
      <p className="text-[11px] text-text-light mb-3 px-1 leading-relaxed">
        국민동의청원에서 동의 진행 중인 청원이에요(찬반 모두 표시). 동의는 국회 사이트에서 본인인증 후 가능해요.
      </p>

      <div className="space-y-2.5">
        {petitions.map((p) => {
          const pct = Math.min(100, Math.round((p.agreeCount / p.goal) * 100));
          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block active:scale-[0.99] transition-transform"
            >
              <div
                className="px-4 py-3.5"
                style={{
                  background: "#FFFFFF",
                  borderRadius: "var(--radius-card-sm)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[13px] font-bold text-text-main leading-snug">
                    {p.title}
                  </p>
                  <ExternalLink size={13} className="shrink-0 mt-0.5 text-text-light" />
                </div>

                <div
                  className="mt-2.5 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, #8B9DC3 0%, #6B7FA3 100%)",
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-text-sub">
                    <b className="text-text-main">{p.agreeCount.toLocaleString()}</b>
                    {" / "}
                    {p.goal.toLocaleString()}명 동의 ({pct}%)
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: "#6B7FA3" }}>
                    {dday(p.endDate)}
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
