"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BriefcaseMedical } from "lucide-react";

const STEPS = [
  { step: 1, title: "안전 확보", color: "#EF4444", items: ["장갑 착용 (겁먹은 고양이는 물 수 있음)", "큰 소리와 급한 움직임 금지", "차도 근처라면 교통 안전 먼저 확인"] },
  { step: 2, title: "지혈 및 응급처치", color: "#F97316", items: ["출혈 시 깨끗한 천으로 상처 부위 압박", "골절 의심 시 움직이지 않도록 고정", "절대 사람용 약 투여 금지 (독성 위험)"] },
  { step: 3, title: "신속한 이송", color: "#3B82F6", items: ["담요나 수건으로 부드럽게 감싸기", "상자나 캐리어에 넣어 이동", "가장 가까운 24시 동물병원으로 이송", "이송 중 체온 유지에 주의"] },
];

export default function EmergencyGuidePage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-14 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">응급 구조 가이드</h1>
      </div>

      <div className="card p-5 mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
          <BriefcaseMedical size={24} color="#EF4444" />
        </div>
        <p className="text-[14px] text-text-sub leading-relaxed">
          다친 길고양이를 발견했을 때<br/>
          <strong className="text-text-main">안전하게 구조하는 방법</strong>
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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <a href="tel:112" className="card p-4 flex flex-col items-center active:scale-95 transition-transform">
          <span className="text-lg mb-1">🚔</span>
          <p className="text-[13px] font-semibold text-text-main">경찰</p>
          <p className="text-sm font-bold text-primary">112</p>
        </a>
        <a href="tel:1577-0954" className="card p-4 flex flex-col items-center active:scale-95 transition-transform">
          <span className="text-lg mb-1">🐾</span>
          <p className="text-[13px] font-semibold text-text-main">동물보호콜센터</p>
          <p className="text-sm font-bold text-primary">1577-0954</p>
        </a>
      </div>
    </div>
  );
}
