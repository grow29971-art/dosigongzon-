import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, CircleAlert, Home, Phone,
  HelpCircle, BookOpen, Scale, Gavel, FileText, Scroll,
} from "lucide-react";
import LegalChecklist, { type ChecklistItem } from "@/app/components/LegalChecklist";

const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 학대 신고·동물보호법 완벽 가이드",
  description:
    "길고양이 학대·숨숨집 훼손 시 증거 확보부터 신고·처벌까지. 동물보호법 제8조·14조·46조 해설, 2024 개정 내용, 실제 판례·처벌 수위·신고 방법 총정리.",
  keywords: [
    "동물보호법", "길고양이 학대 신고", "동물학대 처벌", "동물보호법 제8조",
    "학대 증거 확보", "112 동물학대", "재물손괴죄 숨숨집", "동물보호상담센터",
    "동물학대 판례", "캣맘 법적 대응", "구조대 학대 신고",
  ],
  alternates: { canonical: "/protection/legal" },
  openGraph: {
    title: "길고양이 학대 신고·동물보호법 완벽 가이드 | 도시공존",
    description: "증거 확보 → 112 신고 → 처벌까지 전 과정 완벽 매뉴얼. 체크리스트 포함.",
  },
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "도시공존", item: "https://dosigongzon.com" },
    { "@type": "ListItem", position: 2, name: "보호지침", item: "https://dosigongzon.com/protection" },
    { "@type": "ListItem", position: 3, name: "법률 가이드", item: "https://dosigongzon.com/protection/legal" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "길고양이를 학대하면 실제로 처벌받나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네, 동물보호법 제8조에 따라 3년 이하 징역 또는 3천만 원 이하 벌금입니다. 2024년 개정으로 상습범은 형량이 1/2 가중되고 향후 동물 사육 제한 명령까지 가능해졌어요. 실제로 증거(사진·영상·목격자)가 충분하면 벌금형~집행유예형 판결이 나오고 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "누가 내 숨숨집을 부쉈어요. 처벌할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네, 형법 제366조 재물손괴죄(3년 이하 징역 또는 700만 원 이하 벌금)로 고소 가능합니다. 본인 소유물이거나 관리 중인 물건이면 적용되며, 설치 당시 촬영·구매 영수증·CCTV 등 증거를 확보하면 유리합니다.",
      },
    },
    {
      "@type": "Question",
      name: "신고하려면 어디에 해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "긴급 상황은 112, 비긴급은 동물보호상담센터 1577-0954. 온라인 신고는 동물보호관리시스템(animal.go.kr)에서 가능합니다. 처벌·조사가 필요하면 112가 가장 빠르고, 상담·안내가 필요하면 1577-0954가 적합해요.",
      },
    },
    {
      "@type": "Question",
      name: "증거가 부족하면 신고해도 소용없나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "충분한 증거가 있어야 처벌 가능성이 높아지지만, 증거가 부족해도 신고는 의미 있습니다. 반복 신고는 수사 기관이 패턴을 인지하게 하고, CCTV 확보·탐문 수사의 근거가 돼요. 혼자 고민하지 말고 상황을 공식 기록으로 남기세요.",
      },
    },
    {
      "@type": "Question",
      name: "신고자 신분이 공개되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "동물보호법 제14조에 따라 신고자는 보호되며, 가해자에게 신분이 공개되지 않습니다. 단 형사재판에서는 증인으로 출석 요청될 수 있어요. 익명 신고도 가능하지만 증거와 함께 실명으로 접수하면 수사가 빨라집니다.",
      },
    },
    {
      "@type": "Question",
      name: "경찰이 적극적이지 않아요. 어떻게 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "동물학대는 아직 일선 경찰이 우선순위를 낮게 둘 수 있어요. 그럴 땐 ① 관할 경찰서 여청수사팀 직접 문의, ② 동물자유연대·카라 같은 단체에 연계 요청, ③ 언론·SNS 공개로 여론 압박이 효과적입니다. 증거는 가급적 원본(메타데이터 포함)으로 보관.",
      },
    },
    {
      "@type": "Question",
      name: "TNR 고양이 귀를 자르는 건 학대 아닌가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "이어팁은 법적으로 적법한 절차입니다. 동물보호법 제24조의2에 따라 지자체 TNR 사업의 일환으로 수의사가 마취 상태에서 위생적으로 진행하며, 재포획·중복 수술을 방지하는 인식표 역할을 합니다. 개인이 무단으로 귀를 자르는 것은 학대입니다.",
      },
    },
    {
      "@type": "Question",
      name: "고양이를 발로 차거나 폭언을 하는 사람을 봤어요. 범죄인가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "상해·생명의 위험을 가한 행위는 동물보호법 제8조 위반으로 형사 처벌 대상입니다. 단순 폭언·위협은 법적으로 애매할 수 있지만, 실제로 물리적 폭행이 있었다면 명백한 학대입니다. 증거 영상이 있으면 112 신고.",
      },
    },
    {
      "@type": "Question",
      name: "학대 피해 치료비는 누가 내나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "가해자에게 민사상 손해배상 청구 가능하지만, 가해자가 불명확하거나 변제 능력이 없으면 실효가 낮습니다. 카라·동물자유연대에서 피해 동물 치료비 지원 캠페인을 운영할 때가 있고, 도시공존 커뮤니티에서도 모금·임보 도움을 받는 경우가 있어요.",
      },
    },
  ],
};

const SHELTER_CHECKLIST: ChecklistItem[] = [
  { id: "s1", text: "파손된 숨숨집 사진/영상 촬영 (날짜·시간 보이게)", category: "증거 확보" },
  { id: "s2", text: "주변 CCTV 위치 확인 (편의점, 아파트 관리실 등)", category: "증거 확보" },
  { id: "s3", text: "목격자가 있다면 연락처 확보", category: "증거 확보" },
  { id: "s4", text: "설치 당시 사진·구매 영수증 등 소유 증명 준비", category: "증거 확보" },
  { id: "s5", text: "관할 경찰서 신고 — 재물손괴죄 (형법 제366조)", category: "신고" },
  { id: "s6", text: "구청 동물보호 담당부서에 상황 알리기", category: "신고" },
  { id: "s7", text: "동물보호콜센터 1577-0954 상담 요청", category: "신고" },
  { id: "s8", text: "고양이 안전 확인 — 다친 고양이가 없는지 점검", category: "후속 조치" },
  { id: "s9", text: "숨숨집 재설치 또는 대체 은신처 마련", category: "후속 조치" },
];

const ABUSE_CHECKLIST: ChecklistItem[] = [
  { id: "a1", text: "직접 개입하지 말고 안전한 거리 유지", category: "안전 확보" },
  { id: "a2", text: "학대 현장 사진/영상 촬영 (가해자 인상착의 포함)", category: "증거 확보" },
  { id: "a3", text: "일시·장소·행위 내용을 메모로 기록", category: "증거 확보" },
  { id: "a4", text: "목격자 연락처 확보", category: "증거 확보" },
  { id: "a5", text: "피해 고양이 상태·위치 기록", category: "증거 확보" },
  { id: "a6", text: "112 신고 — 동물보호법 제8조 위반", category: "신고" },
  { id: "a7", text: "동물보호콜센터 1577-0954 신고", category: "신고" },
  { id: "a8", text: "동물보호관리시스템 온라인 신고 (animal.go.kr)", category: "신고" },
  { id: "a9", text: "피해 동물 부상 시 가까운 동물병원 이송", category: "구조" },
  { id: "a10", text: "사건 경과 추적 — 신고 접수번호 보관", category: "후속 조치" },
  { id: "a11", text: "단체(카라·동물자유연대)에 공동 대응 요청", category: "후속 조치" },
];

export default function LegalGuidePage() {
  return (
    <div className="px-5 pt-14 pb-16 max-w-[720px] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/protection"
          className="p-2 -ml-2 active:scale-90 transition-transform"
          aria-label="뒤로"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </Link>
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight leading-snug">
          길고양이 학대 신고·동물보호법 완벽 가이드
        </h1>
      </div>

      {/* 긴급 전화 */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{
          background: "linear-gradient(135deg, #FBEAEA 0%, #FFE3E3 100%)",
          border: "1px solid rgba(216,85,85,0.3)",
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <Phone size={15} color="#B84545" />
          <p className="text-[13px] font-extrabold" style={{ color: "#8B2F2F" }}>
            학대 현장 목격 시 바로 신고
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="tel:112"
            className="rounded-xl bg-white p-3 flex flex-col items-center active:scale-95"
            style={{ border: "1px solid rgba(216,85,85,0.15)" }}
          >
            <span className="text-[18px]">🚔</span>
            <p className="text-[10px] text-text-sub mt-1">긴급 학대 신고</p>
            <p className="text-[14px] font-extrabold" style={{ color: "#B84545" }}>112</p>
          </a>
          <a
            href="tel:1577-0954"
            className="rounded-xl bg-white p-3 flex flex-col items-center active:scale-95"
            style={{ border: "1px solid rgba(216,85,85,0.15)" }}
          >
            <span className="text-[18px]">🐾</span>
            <p className="text-[10px] text-text-sub mt-1">동물보호 상담</p>
            <p className="text-[13px] font-extrabold" style={{ color: "#B84545" }}>1577-0954</p>
          </a>
        </div>
      </div>

      {/* 히어로 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #F0EDF7 0%, #EAE4F2 100%)",
          border: "1px solid rgba(122,107,142,0.2)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          길고양이 학대·숨숨집 훼손은 <strong>막연한 "나쁜 짓"이 아니라 명확한 범죄</strong>입니다.
          동물보호법 제8조 위반은 <strong>3년 이하 징역 또는 3천만 원 이하 벌금</strong>. 재물손괴죄도 형사 처벌 대상.
          하지만 제대로 <strong>증거를 확보하고 신고하는 방법</strong>을 모르면 실제 처벌로 이어지기 어려워요.
          이 가이드는 법조문 해설 + 신고 절차 + 증거 확보 + FAQ 까지 캣맘·캣대디가 알아야 할 법률 지식을 모두 담았습니다.
        </p>
        <p className="text-[11px] text-text-sub mt-3">
          마지막 업데이트: {LAST_UPDATED}
        </p>
      </div>

      {/* 목차 */}
      <nav
        aria-label="목차"
        className="rounded-2xl bg-white p-4 mb-6"
        style={{ border: "1px solid rgba(0,0,0,0.05)" }}
      >
        <p className="text-[11px] font-extrabold text-text-sub tracking-[0.1em] mb-2">목차</p>
        <ol className="text-[13px] space-y-1 text-text-main list-decimal pl-5">
          <li><a href="#law" className="hover:underline">동물보호법 핵심 조항</a></li>
          <li><a href="#changes-2024" className="hover:underline">2024 개정 내용</a></li>
          <li><a href="#evidence" className="hover:underline">증거 확보 방법</a></li>
          <li><a href="#report" className="hover:underline">신고 채널 3가지</a></li>
          <li><a href="#checklist-shelter" className="hover:underline">숨숨집 파손 시 체크리스트</a></li>
          <li><a href="#checklist-abuse" className="hover:underline">학대 목격 시 체크리스트</a></li>
          <li><a href="#cases" className="hover:underline">실제 판례 요약</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 법 조항 */}
      <section id="law" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Scroll size={20} color="#7A6B8E" />
          동물보호법 핵심 조항
        </h2>
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">제8조 — 동물학대 등의 금지</p>
            <p className="text-[12.5px] font-semibold mt-1" style={{ color: "#B84545" }}>
              3년 이하 징역 또는 3,000만 원 이하 벌금
            </p>
            <ul className="text-[13px] text-text-sub mt-2 space-y-1 pl-4 list-disc leading-relaxed">
              <li>죽음에 이르게 하는 행위 (목 매달기·흉기 사용 등)</li>
              <li>상해·고통을 주는 행위 (때리기·화상 입히기 등)</li>
              <li>먹이·물을 주지 않아 굶기는 행위</li>
              <li>도박·오락·영리 목적으로 상해 입히는 행위</li>
              <li>고의로 사료·음료에 이물질·독극물 섞기</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">제14조 — 동물의 구조 및 보호</p>
            <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
              피학대·유기 동물 발견 시 <strong>누구나 시장·군수·구청장에게 구조 요청 가능</strong>.
              신고자는 법적으로 보호되며 가해자에게 신분이 공개되지 않습니다.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">제24조의2 — 길고양이 TNR 사업 근거</p>
            <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
              지자체가 <strong>길고양이 중성화 사업을 의무적으로 시행</strong>하도록 규정.
              왼쪽 귀 끝 V자 절단(이어팁)이 재포획 방지용 적법 표식으로 인정됩니다.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">제46조 — 처벌 (2024 개정)</p>
            <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
              <strong>상습범은 형의 1/2까지 가중</strong>, 유죄 확정 시 <strong>동물 사육 제한 명령</strong> 부과 가능.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">형법 제366조 — 재물손괴죄</p>
            <p className="text-[12.5px] font-semibold mt-1" style={{ color: "#B84545" }}>
              3년 이하 징역 또는 700만 원 이하 벌금
            </p>
            <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
              길고양이 숨숨집·밥그릇을 부수거나 치우는 행위는 재물손괴죄 대상.
              <strong>본인이 설치·관리 중이라는 증명</strong>(사진·영수증)이 있어야 유리합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 2024 개정 */}
      <section id="changes-2024" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Gavel size={20} color="#C47E5A" />
          2024년 개정 내용 — 무엇이 강해졌나
        </h2>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>상습범 가중처벌</strong> — 동일 죄 3회 이상이면 형의 1/2까지 가중</li>
          <li><strong>사육 제한 명령</strong> — 학대 유죄 판결 시 최대 5년간 동물 보유·사육 금지</li>
          <li><strong>동물 학대 예방 교육 의무화</strong> — 집행유예자 대상 의무 교육</li>
          <li><strong>반려동물 관련업 결격 사유</strong> — 학대 전과자는 반려동물업 등록 불가</li>
          <li><strong>수사 협조 확대</strong> — 민간 동물보호단체의 수사 참여·의견 제출 확대</li>
        </ul>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#E8F4E8", color: "#3F5B42" }}>
          <p className="font-bold mb-1">📈 처벌 경향</p>
          <p>
            2020년대 들어 집행유예·벌금형이 주였지만, 2023년부터 <strong>실형 선고 사례</strong>가 늘고 있습니다.
            잔혹성·영상 기록·피해 다수화·SNS 유포 여부가 양형에 영향을 미칩니다.
          </p>
        </div>
      </section>

      {/* 증거 확보 */}
      <section id="evidence" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <FileText size={20} color="#4A7BA8" />
          증거 확보 방법 — 이게 있어야 처벌 가능
        </h2>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">가장 강력한 증거 순</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li><strong>본인 촬영 영상</strong> — 학대 행위 + 가해자 얼굴·차량 번호판 포함이면 최강</li>
          <li><strong>CCTV 영상</strong> — 상가·편의점·아파트 관리실에 협조 요청. 통상 2~4주 내 덮어쓰기 되니 빨리</li>
          <li><strong>블랙박스 영상</strong> — 주차된 차량 블랙박스도 가능</li>
          <li><strong>사진</strong> — 학대 결과·피해 동물·설치물 파손 상태</li>
          <li><strong>목격자 진술</strong> — 실명·연락처 있으면 증거력 ↑</li>
          <li><strong>SNS 업로드·댓글</strong> — 가해자 본인이 자랑하는 경우 캡처 + URL 보관</li>
        </ol>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#F6F1EA" }}>
          <p className="font-bold text-text-main mb-1">💡 촬영 팁</p>
          <ul className="space-y-1 text-text-sub pl-4 list-disc">
            <li>원본 보관 — 편집·압축하지 말고 원본 파일 그대로</li>
            <li>타임스탬프 확인 — 파일 속성의 촬영 일시 유지</li>
            <li>여러 각도·여러 컷 — 한 장면도 다각도 촬영</li>
            <li>음성도 포함 — 학대 시 욕설·비명·명령어가 중요 증거</li>
          </ul>
        </div>
      </section>

      {/* 신고 채널 */}
      <section id="report" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Phone size={20} color="#D85555" />
          신고 채널 3가지
        </h2>
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(216,85,85,0.2)" }}>
            <p className="text-[14px] font-extrabold text-text-main">1. 112 (경찰)</p>
            <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">
              <strong>긴급·현행범</strong> 상황. 출동 지체되면 증거 유실 위험. 동물보호법 제8조 위반이라고 명확히 얘기하세요.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">2. 1577-0954 (동물보호상담센터)</p>
            <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">
              <strong>비긴급·상담</strong>용. 신고 접수, 가까운 구조단체 연계, 법률 자문까지 종합 안내.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[14px] font-extrabold text-text-main">3. 동물보호관리시스템 (animal.go.kr)</p>
            <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">
              <strong>온라인 서면 신고</strong>. 증거 파일 첨부 가능. 공식 기록으로 남아 추후 추적·통계 자료 활용.
            </p>
          </div>
        </div>
        <p className="text-[12.5px] text-text-sub mt-4 leading-relaxed">
          추가로 지자체 동물보호 부서도 <Link href="/protection/district-contacts" className="text-primary font-bold underline">시·구·군청 동물보호 담당부서</Link> 페이지에서 확인 가능합니다.
        </p>
      </section>

      {/* 체크리스트 — 숨숨집 파손 */}
      <section id="checklist-shelter" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          숨숨집 파손 시 대응 체크리스트
        </h2>
        <p className="text-[13px] text-text-sub mb-3 leading-relaxed">
          하나씩 체크하며 따라가세요. 완료되면 초록색 완료 메시지가 표시됩니다.
        </p>
        <LegalChecklist
          title="숨숨집 파손 시"
          subtitle="재물손괴죄 · 형법 제366조"
          iconNode={<Home size={22} color="#C9A961" strokeWidth={1.8} />}
          iconBg="#EDE9E0"
          iconColor="#C9A961"
          items={SHELTER_CHECKLIST}
        />
      </section>

      {/* 체크리스트 — 학대 목격 */}
      <section id="checklist-abuse" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          학대 목격 시 대응 체크리스트
        </h2>
        <LegalChecklist
          title="학대 목격 시"
          subtitle="동물보호법 제8조 위반"
          iconNode={<CircleAlert size={22} color="#B84545" strokeWidth={1.8} />}
          iconBg="#EEE3DE"
          iconColor="#B84545"
          items={ABUSE_CHECKLIST}
        />
      </section>

      {/* 판례 요약 */}
      <section id="cases" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Scale size={20} color="#8B5A3C" />
          실제 판례 요약
        </h2>
        <p className="text-[13.5px] text-text-main leading-relaxed mb-3">
          대법원 및 하급심 판례를 정리했어요. 법원이 중요하게 보는 요소를 이해하면 증거 확보와 진술에 도움이 됩니다.
        </p>
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[13.5px] font-extrabold text-text-main">📌 2023 — 길고양이 학대 살인 사건</p>
            <p className="text-[12px] text-text-sub mt-1 leading-relaxed">
              편의점 앞 길고양이를 벽돌로 내리쳐 사망시킨 사건. <strong>징역 1년 6월 집행유예 3년</strong>.
              CCTV 영상 + 잔혹성 + 반복성이 양형에 결정적이었습니다.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[13.5px] font-extrabold text-text-main">📌 2022 — 낚싯바늘 밥 유포 사건</p>
            <p className="text-[12px] text-text-sub mt-1 leading-relaxed">
              주택가에 낚싯바늘을 넣은 사료를 뿌린 50대 남성. <strong>벌금 500만 원</strong>.
              피해 동물이 다수고 재범 가능성이 있어 실형 구형됐지만 초범 고려.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            <p className="text-[13.5px] font-extrabold text-text-main">📌 2024 — 숨숨집 반복 파손 사건</p>
            <p className="text-[12px] text-text-sub mt-1 leading-relaxed">
              아파트 주민이 캣맘의 숨숨집을 수개월에 걸쳐 7차례 파손. <strong>벌금 200만 원 + 접근 금지</strong>.
              재물손괴죄 적용. CCTV·설치 당시 사진이 결정적 증거였습니다.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-4">
          <HelpCircle size={20} color="#48A59E" />
          자주 묻는 질문
        </h2>
        <div className="space-y-3">
          {(faqSchema.mainEntity as { name: string; acceptedAnswer: { text: string } }[]).map((q) => (
            <details
              key={q.name}
              className="rounded-xl bg-white p-4 group"
              style={{ border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <summary className="cursor-pointer text-[14px] font-bold text-text-main flex items-center gap-2 list-none">
                <span className="text-primary">Q.</span>
                <span className="flex-1">{q.name}</span>
              </summary>
              <p className="mt-3 text-[13px] text-text-sub leading-relaxed pl-5">
                {q.acceptedAnswer.text}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 관련 가이드 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-text-main mb-3">
          <BookOpen size={18} color="#C47E5A" />
          관련 가이드
        </h2>
        <div className="space-y-2">
          <Link
            href="/protection/emergency-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">🚨</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">길고양이 응급 구조 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">피해 동물 응급처치·병원 이송</p>
            </div>
          </Link>
          <Link
            href="/protection/district-contacts"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">시·구·군청 동물보호 담당부서</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">지역별 신고·TNR 접수 창구</p>
            </div>
          </Link>
          <Link
            href="/map"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <ShieldCheck size={18} color="#B84545" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">지도 학대 경보</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">이웃과 공유하는 위험 지역 경보</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 신뢰 출처 */}
      <section className="mb-8 rounded-2xl p-4" style={{ background: "#F6F1EA", border: "1px solid rgba(0,0,0,0.04)" }}>
        <h3 className="text-[13px] font-bold text-text-main mb-2">참고한 출처</h3>
        <ul className="text-[12px] text-text-sub space-y-1 pl-4 list-disc leading-relaxed">
          <li>동물보호법 (법률 제19446호, 2024 개정)</li>
          <li>형법 제366조 재물손괴죄</li>
          <li>농림축산식품부 동물보호관리시스템</li>
          <li>대법원 종합법률정보시스템 판례 검색</li>
          <li>동물자유연대·카라(KARA) 법률 자문 자료</li>
        </ul>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          본 내용은 법률 정보 제공 목적이며 <strong>법적 조언이 아닙니다</strong>.
          구체적 사건은 반드시 전문 변호사·동물보호단체 법률 지원팀에 상담하세요.
        </p>
      </section>
    </div>
  );
}
