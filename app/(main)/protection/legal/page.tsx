"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, CircleAlert, Home, Check } from "lucide-react";

/* ═══ 체크리스트 데이터 ═══ */
const SHELTER_CHECKLIST = [
  { id: "s1", text: "파손된 숨숨집 사진/영상 촬영 (날짜·시간 보이게)", category: "증거 확보" },
  { id: "s2", text: "주변 CCTV 위치 확인 (편의점, 아파트 관리실 등)", category: "증거 확보" },
  { id: "s3", text: "목격자가 있다면 연락처 확보", category: "증거 확보" },
  { id: "s4", text: "관할 경찰서 신고 — 재물손괴죄 (형법 제366조)", category: "신고" },
  { id: "s5", text: "구청 동물보호 담당부서에 상황 알리기", category: "신고" },
  { id: "s6", text: "동물보호콜센터 1577-0954 상담 요청", category: "신고" },
  { id: "s7", text: "고양이 안전 확인 — 다친 고양이가 없는지 점검", category: "후속 조치" },
  { id: "s8", text: "숨숨집 재설치 또는 대체 은신처 마련", category: "후속 조치" },
];

const ABUSE_CHECKLIST = [
  { id: "a1", text: "직접 개입하지 말고 안전한 거리 유지", category: "안전 확보" },
  { id: "a2", text: "학대 현장 사진/영상 촬영 (가해자 인상착의 포함)", category: "증거 확보" },
  { id: "a3", text: "일시·장소·행위 내용을 메모로 기록", category: "증거 확보" },
  { id: "a4", text: "목격자 연락처 확보", category: "증거 확보" },
  { id: "a5", text: "112 신고 — 동물보호법 제8조 위반", category: "신고" },
  { id: "a6", text: "동물보호콜센터 1577-0954 신고", category: "신고" },
  { id: "a7", text: "동물보호관리시스템 온라인 신고 (animal.go.kr)", category: "신고" },
  { id: "a8", text: "피해 동물 부상 시 가까운 동물병원 이송", category: "구조" },
  { id: "a9", text: "사건 경과 추적 — 신고 접수번호 보관", category: "후속 조치" },
];

/* ═══ 체크리스트 섹션 컴포넌트 ═══ */
function Checklist({
  title,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  items,
}: {
  title: string;
  subtitle: string;
  icon: typeof CircleAlert;
  iconBg: string;
  iconColor: string;
  items: typeof SHELTER_CHECKLIST;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0;

  // 카테고리별 그룹핑 (순서 유지)
  const categories: { name: string; items: typeof SHELTER_CHECKLIST }[] = [];
  for (const item of items) {
    const last = categories[categories.length - 1];
    if (last && last.name === item.category) {
      last.items.push(item);
    } else {
      categories.push({ name: item.category, items: [item] });
    }
  }

  return (
    <div className="card p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={22} color={iconColor} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-main">{title}</p>
          <p className="text-[12px] text-text-sub">{subtitle}</p>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-[#E5E0D6] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: iconColor }}
          />
        </div>
        <span className="text-[11px] font-semibold" style={{ color: iconColor }}>
          {checked.size}/{items.length}
        </span>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name}>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
              {cat.name}
            </p>
            <div className="space-y-1.5">
              {cat.items.map((item) => {
                const done = checked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-start gap-2.5 text-left p-2 rounded-xl active:bg-surface-alt transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                        done ? "border-transparent" : "border-border"
                      }`}
                      style={done ? { backgroundColor: iconColor } : {}}
                    >
                      {done && <Check size={13} color="white" strokeWidth={3} />}
                    </div>
                    <span
                      className={`text-[13px] leading-relaxed transition-colors duration-200 ${
                        done ? "text-text-muted line-through" : "text-text-sub"
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 완료 메시지 */}
      {progress === 100 && (
        <div className="mt-4 p-3 rounded-2xl bg-[#E8ECE5] text-center">
          <p className="text-[13px] font-semibold text-[#6B8E6F]">
            모든 단계를 완료했습니다
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══ 페이지 ═══ */
export default function LegalGuidePage() {
  const router = useRouter();

  return (
    <div className="px-5 pt-14 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">법률 가이드</h1>
      </div>

      {/* 법률 요약 */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EAE6E8] flex items-center justify-center">
            <ShieldCheck size={24} color="#7A6B8E" />
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

      {/* 섹션 타이틀 */}
      <div className="px-1 mb-3 mt-6">
        <h2 className="text-[16px] font-extrabold text-text-main">대응 체크리스트</h2>
        <p className="text-[12px] text-text-sub mt-0.5">상황별로 하나씩 체크하며 따라가세요</p>
      </div>

      {/* 체크리스트들 */}
      <div className="space-y-4">
        <Checklist
          title="숨숨집 파손 시"
          subtitle="재물손괴죄 · 형법 제366조"
          icon={Home}
          iconBg="#EDE9E0"
          iconColor="#C9A961"
          items={SHELTER_CHECKLIST}
        />

        <Checklist
          title="학대 목격 시"
          subtitle="동물보호법 제8조 위반"
          icon={CircleAlert}
          iconBg="#EEE3DE"
          iconColor="#B84545"
          items={ABUSE_CHECKLIST}
        />
      </div>

      {/* 긴급 연락처 */}
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

      <p className="text-[11px] text-text-muted text-center mt-6 leading-relaxed">
        본 내용은 법률 정보 제공 목적이며, 법적 조언이 아닙니다.<br/>정확한 법률 상담은 전문 변호사에게 문의하세요.
      </p>
    </div>
  );
}
