"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function LegalGuidePage() {
  const router = useRouter();
  return (
    <div className="px-5 pt-14 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">법률 가이드</h1>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] flex items-center justify-center">
            <ShieldCheck size={24} color="#8B5CF6" />
          </div>
          <div>
            <p className="text-base font-bold text-text-main">동물보호법 안내</p>
            <p className="text-xs text-text-sub">학대/훼손 대응 매뉴얼</p>
          </div>
        </div>
        <div className="space-y-3 text-[14px] text-text-sub leading-relaxed">
          <p><strong className="text-text-main">제8조</strong> — 동물학대 등의 금지<br/>3년 이하 징역 또는 3,000만원 이하 벌금</p>
          <p><strong className="text-text-main">제14조</strong> — 동물의 구조 및 보호<br/>피학대 동물 발견 시 신고 가능, 신고자 보호</p>
          <p><strong className="text-text-main">제24조의2</strong> — TNR 사업 법적 근거<br/>지자체 중성화 사업, 이어팁 표시 의무</p>
          <p><strong className="text-text-main">제46조</strong> — 처벌 강화 (2024 개정)<br/>상습범 형의 1/2 가중, 사육 제한 명령</p>
        </div>
      </div>

      <p className="text-[11px] text-text-muted text-center mt-6 leading-relaxed">
        본 내용은 법률 정보 제공 목적이며, 법적 조언이 아닙니다.<br/>정확한 법률 상담은 전문 변호사에게 문의하세요.
      </p>
    </div>
  );
}
