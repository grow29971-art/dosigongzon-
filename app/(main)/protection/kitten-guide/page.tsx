"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Cat } from "lucide-react";

const STEPS = [
  { step: 1, title: "관찰 (2~3시간)", color: "#C9A961", items: ["엄마 고양이가 올 수 있으니 2~3시간 관찰", "사람 냄새가 묻으면 엄마가 거부할 수 있음", "위험한 장소가 아니라면 함부로 만지지 않기"] },
  { step: 2, title: "체온 유지", color: "#C47E5A", items: ["새끼 고양이는 스스로 체온 유지가 어려움", "수건이나 담요로 감싸주기", "핫팩은 화상 위험 — 수건으로 감싼 뒤 사용"] },
  { step: 3, title: "급여 (KMR 분유)", color: "#6B8E6F", items: ["절대 우유 금지! (유당불내증)", "고양이 전용 분유(KMR) 사용", "2~3시간 간격으로 소량씩 급여", "생후 4주 이전은 젖병, 이후는 접시 급여 가능"] },
];

export default function KittenGuidePage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-14 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">냥줍 가이드</h1>
      </div>

      <div className="card p-5 mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#EDE9E0] flex items-center justify-center">
          <Cat size={24} color="#C9A961" />
        </div>
        <p className="text-[14px] text-text-sub leading-relaxed">
          새끼 고양이를 발견했을 때<br/>
          <strong className="text-text-main">침착하게 단계별로 대응하세요</strong>
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
