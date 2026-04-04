import { Stethoscope } from "lucide-react";

export default function HospitalsPage() {
  return (
    <div className="px-5 pt-14 pb-4">
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">동물병원</h1>
      <p className="text-sm text-text-sub mt-1">지역별 길고양이 협력 병원을 찾아보세요</p>
      <div className="flex flex-col items-center pt-20 text-text-light">
        <Stethoscope size={48} strokeWidth={1.2} />
        <p className="text-base mt-4 text-text-sub">Phase 2에서 구현 예정</p>
        <p className="text-[13px] mt-1">진료비 비교 · 후기 · TNR 협력병원</p>
      </div>
    </div>
  );
}
