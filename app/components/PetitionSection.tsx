"use client";

// 진행 중인 길고양이 관련 청원 링크 카드 (2026-08-15, 사장님 지시로 7/22 기각 결정 번복)
// 국회 국민동의청원은 /api/petitions(1시간 ISR 프록시, 8/4 오삭제됐던 라우트 복원)로 실시간 자동 수집,
// 국회 밖 청원(청원24 등)은 MANUAL_PETITIONS에 한 줄 추가 — 마감 지나면 자동 숨김.
// 7/22 회의 하한선 준수: 서명·동의 수집 없음, 카피 중립, 정렬은 마감임박순(진영 부스팅 방지).
// 전체 카드는 홈의 SHOW_PETITION 플래그로 롤백.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 아이콘 박스 → 회색 선 아이콘, 구분선 리스트.

import { useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";

interface DisplayPetition {
  key: string;
  title: string;
  sub: string; // 플랫폼·동의수 등 부가 정보 (D-day 제외)
  url: string;
  until: string; // YYYY-MM-DD
}

const MANUAL_PETITIONS: DisplayPetition[] = [
  {
    key: "cheongwon-14",
    title: "동물보호법 시행규칙 제14조 길고양이 구조·보호조치 예외 규정 삭제 등 촉구",
    sub: "청원24 · 의견수렴 중",
    url: "https://www.cheongwon.go.kr/portal/petition/open/viewdetail/PRIb51350afcaa743f1a6e247ab051e3927",
    until: "2026-08-21",
  },
];

interface ApiPetition {
  id: string;
  title: string;
  agreeCount: number;
  goal: number;
  endDate: string;
  url: string;
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dday(until: string, today: string): number {
  return Math.round((new Date(until).getTime() - new Date(today).getTime()) / 86400000);
}

export default function PetitionSection() {
  const [assembly, setAssembly] = useState<DisplayPetition[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/petitions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { petitions?: ApiPetition[] } | null) => {
        if (!alive || !data?.petitions) return;
        setAssembly(
          data.petitions.map((p) => ({
            key: p.id,
            title: p.title,
            sub: `국회 국민동의청원 · ${p.agreeCount.toLocaleString()}명 동의`,
            url: p.url,
            until: p.endDate,
          })),
        );
      })
      .catch(() => { /* 국회 API 장애 — 수동 목록만 노출 */ });
    return () => { alive = false; };
  }, []);

  const today = kstToday();
  const active = [...MANUAL_PETITIONS, ...assembly]
    .filter((p) => p.until >= today)
    .sort((a, b) => a.until.localeCompare(b.until)); // 마감임박순 (7/23 중립 정렬 결정)
  if (active.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="px-1 mb-2">
        <h2 className="text-[17px] font-bold text-text-main">진행 중인 청원</h2>
      </div>
      <div className="card overflow-hidden">
        {active.map((p, i) => {
          const d = dday(p.until, today);
          return (
            <a
              key={p.key}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 press"
              style={{ minHeight: 56, borderTop: i > 0 ? "1px solid var(--color-divider)" : "none" }}
            >
              <Megaphone size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-snug line-clamp-2">{p.title}</p>
                <p className="text-[13px] text-text-sub mt-0.5">
                  {p.sub} · {d === 0 ? "오늘 마감" : `D-${d}`}
                </p>
              </div>
              <ExternalLink size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
            </a>
          );
        })}
        <p className="px-4 py-2.5 text-[11px] text-text-light" style={{ borderTop: "1px solid var(--color-divider)" }}>
          내용을 확인하고 의견을 남길 수 있어요 · 외부 사이트로 이동합니다
        </p>
      </div>
    </div>
  );
}
