"use client";

// 진행 중인 길고양이 관련 청원 링크 카드 (2026-08-15, 사장님 지시로 7/22 기각 결정 번복)
// 시스템이 아니라 큐레이션 리스트: 새 청원은 PETITIONS에 한 줄 추가, 마감 지나면 자동 숨김.
// 카피는 중립 유지(특정 입장 유도 금지 — 7/22 회의 리스크 회피). 전체 카드는 SHOW_PETITION 플래그로 롤백.

import { ExternalLink, Megaphone } from "lucide-react";

interface Petition {
  title: string;
  org: string; // 플랫폼·단계 표기
  url: string;
  until: string; // YYYY-MM-DD (마감일, 이날까지 노출)
}

const PETITIONS: Petition[] = [
  {
    title: "동물보호법 시행규칙 제14조 길고양이 구조·보호조치 예외 규정 삭제 등 촉구",
    org: "청원24 · 의견수렴 중",
    url: "https://www.cheongwon.go.kr/portal/petition/open/viewdetail/PRIb51350afcaa743f1a6e247ab051e3927",
    until: "2026-08-21",
  },
];

function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dday(until: string, today: string): number {
  return Math.round((new Date(until).getTime() - new Date(today).getTime()) / 86400000);
}

export default function PetitionSection() {
  const today = kstToday();
  const active = PETITIONS.filter((p) => p.until >= today);
  if (active.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 px-1 mb-3">
        <h2 className="text-[17px] font-bold text-text-main tracking-tight">진행 중인 청원</h2>
      </div>
      <div className="card overflow-hidden">
        {active.map((p, i) => {
          const d = dday(p.until, today);
          return (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3.5 press ${i > 0 ? "border-t" : ""}`}
              style={i > 0 ? { borderColor: "var(--color-divider)" } : undefined}
            >
              <div
                className="w-9 h-9 flex items-center justify-center shrink-0"
                style={{ background: "var(--color-primary-soft)", borderRadius: "var(--radius-square-lg)" }}
              >
                <Megaphone size={16} style={{ color: "var(--color-primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text-main leading-snug line-clamp-2">{p.title}</p>
                <p className="text-[11px] text-text-light mt-0.5">
                  {p.org} · {d === 0 ? "오늘 마감" : `D-${d}`}
                </p>
              </div>
              <ExternalLink size={14} className="shrink-0 text-text-muted" />
            </a>
          );
        })}
        <p className="px-4 py-2.5 text-[11px] text-text-light" style={{ borderTop: "1px solid var(--color-divider)", background: "var(--color-gray-50)" }}>
          내용을 확인하고 찬성·반대 의견을 남길 수 있어요 · 외부 사이트로 이동합니다
        </p>
      </div>
    </div>
  );
}
