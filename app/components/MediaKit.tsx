"use client";

// 언론·블로그·동물보호단체용 미디어 키트.
// 로고 다운로드 + 한 줄 소개 복사 + 데이터 협업 안내.

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";

interface MediaKitProps {
  cats: number;
  users: number;
  hospitals: number;
}

export default function MediaKit({ cats, users, hospitals }: MediaKitProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const blurbs = [
    {
      id: "short",
      label: "한 줄 (트위터·인용용)",
      text: `도시공존은 서울 시민이 함께 만드는 길고양이 돌봄 지도예요. 캣맘·캣대디 ${users.toLocaleString()}명이 ${cats.toLocaleString()}마리의 기록을 공유합니다. https://dosigongzon.com`,
    },
    {
      id: "medium",
      label: "두 문단 (블로그·보도용)",
      text: `도시공존(dosigongzon.com)은 서울 전역의 길고양이를 시민이 함께 기록하고 돌보는 비영리 시민 참여 플랫폼입니다. 캣맘·캣대디가 지도 위에 TNR 상태, 건강, 급식 기록을 실시간으로 남기고, 긴급 구조가 필요한 아이에게 동네 이웃이 빠르게 닿을 수 있도록 돕습니다.\n\n현재 ${cats.toLocaleString()}마리의 길고양이가 등록되어 있고, ${users.toLocaleString()}명의 시민이 동네 단위로 돌봄을 기록하고 있습니다. 길고양이 안전을 위해 급식소 정확 좌표는 비공개이며, 광고 없는 무료 운영을 원칙으로 합니다.`,
    },
    {
      id: "factsheet",
      label: "팩트시트 (수치 중심)",
      text: `도시공존 (dosigongzon.com)\n· 카테고리: 길고양이 돌봄·구조·TNR 시민 참여 플랫폼\n· 운영 지역: 서울특별시 전역 (25개 자치구)\n· 등록 길고양이: ${cats.toLocaleString()}마리\n· 참여 시민: ${users.toLocaleString()}명\n· 등록 치료 병원: ${hospitals.toLocaleString()}곳\n· 운영 형태: 비영리·무료·광고 없음\n· 운영자: 김성우 (grow29971@gmail.com)\n· 출시: 2026년\n· 플랫폼: 웹 + Android (Play Store)\n· 핵심 가치: 안전·중립·공신력 있는 자료 기반`,
    },
  ];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("복사해주세요:", text);
    }
  };

  return (
    <div className="space-y-3">
      {/* 한 줄 소개 복사 카드들 */}
      {blurbs.map((b) => (
        <div
          key={b.id}
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase" style={{ color: "#C47E5A" }}>
              {b.label}
            </span>
            <button
              onClick={() => handleCopy(b.id, b.text)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
              style={{
                background: copiedId === b.id ? "#E8F5E9" : "rgba(196,126,90,0.10)",
                color: copiedId === b.id ? "#2E7D32" : "#A8684A",
              }}
            >
              {copiedId === b.id ? <Check size={11} /> : <Copy size={11} />}
              <span className="text-[10.5px] font-extrabold">
                {copiedId === b.id ? "복사됨" : "복사"}
              </span>
            </button>
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed whitespace-pre-line">
            {b.text}
          </p>
        </div>
      ))}

      {/* 로고 다운로드 */}
      <div
        className="bg-white rounded-2xl p-4"
        style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
      >
        <p className="text-[11px] font-extrabold tracking-[0.1em] uppercase mb-2.5" style={{ color: "#C47E5A" }}>
          로고 · 아이콘 다운로드
        </p>
        <div className="grid grid-cols-3 gap-2">
          <LogoCard href="/icons/icon-512.png" label="앱 아이콘 512" filename="dosigongzon-512.png" />
          <LogoCard href="/icons/icon-192.png" label="아이콘 192" filename="dosigongzon-192.png" />
          <LogoCard href="/icons/apple-touch-icon.png" label="Apple Touch" filename="dosigongzon-apple.png" />
        </div>
        <p className="text-[10.5px] text-text-light mt-2.5 leading-relaxed">
          ※ 비영리·도움 보도용은 자유 사용. 상업적·왜곡 사용은 사전 협의 부탁드려요.
        </p>
      </div>
    </div>
  );
}

function LogoCard({ href, label, filename }: { href: string; label: string; filename: string }) {
  return (
    <a
      href={href}
      download={filename}
      className="flex flex-col items-center gap-1 py-3 rounded-xl active:scale-95 transition-transform"
      style={{ background: "#FFF8F2", border: "1px solid rgba(196,126,90,0.20)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          backgroundImage: `url('${href}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <span className="text-[10px] font-extrabold mt-0.5" style={{ color: "#8B5A3C" }}>
        {label}
      </span>
      <Download size={10} style={{ color: "#C47E5A" }} />
    </a>
  );
}
