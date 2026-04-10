"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Hand } from "lucide-react";

const STEPS = [
  { step: 1, title: "준비물 확인", color: "#6B8E6F", items: ["포획틀 (동물보호센터 대여 가능)", "참치/습식사료 (미끼용)", "두꺼운 장갑 + 큰 수건", "이동장 (캐리어)"] },
  { step: 2, title: "포획틀 설치", color: "#5B7A8F", items: ["고양이가 자주 다니는 경로에 설치", "포획틀 아래 신문지 깔기", "입구 반대편에 미끼 배치", "밝은 조명은 피하기 (어두운 곳 선호)"] },
  { step: 3, title: "대기", color: "#7A6B8E", items: ["포획틀에서 떨어져 관찰 (최소 10m)", "30분~수시간 소요될 수 있음", "소음 최소화, 인내심 필요", "여러 마리인 경우 한 마리씩 진행"] },
  { step: 4, title: "주의사항", color: "#B84545", items: ["포획 후 수건으로 틀을 덮어 안정시키기", "절대 맨손으로 만지지 않기", "TNR 고양이(이어팁)는 재포획 불필요", "포획 후 최대한 빨리 병원/보호소 이동"] },
];

export default function TrappingGuidePage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-14 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">포획 가이드</h1>
      </div>

      <div className="card p-5 mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#E8ECE5] flex items-center justify-center">
          <Hand size={24} color="#6B8E6F" />
        </div>
        <p className="text-[14px] text-text-sub leading-relaxed">
          안전한 포획을 위한<br/>
          <strong className="text-text-main">단계별 가이드</strong>
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((s) => (
          <div key={s.step} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-white text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: s.color }}>
                STEP {s.step}
              </span>
              <span className="text-[15px] font-bold text-text-main">{s.title}</span>
            </div>
            <ul className="space-y-1.5 pl-1">
              {s.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-text-sub leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: s.color }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
