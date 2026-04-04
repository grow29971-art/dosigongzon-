import { Box } from "lucide-react";

export default function SheltersPage() {
  return (
    <div className="px-5 pt-14 pb-4">
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">스마트 쉼터</h1>
      <p className="text-sm text-text-sub mt-1">내가 관리하는 쉼터 상태를 확인하세요</p>
      <div className="flex flex-col items-center pt-20 text-text-light">
        <Box size={48} strokeWidth={1.2} />
        <p className="text-base mt-4 text-text-sub">Phase 2에서 구현 예정</p>
        <p className="text-[13px] mt-1">쉼터 등록 · 상태 모니터링 · 기록</p>
      </div>
    </div>
  );
}
