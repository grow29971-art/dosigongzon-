import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Scissors, Package, MapPin, Clock, AlertTriangle,
  HelpCircle, BookOpen, Stethoscope, Info, CheckCircle2,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 TNR 포획 방법 — 포획틀 설치부터 방사까지",
  description:
    "중성화(TNR)를 위한 안전한 길고양이 포획 가이드. 포획틀 대여·설치 위치·미끼 선정·대기 요령·포획 후 관리·재방사까지 단계별 완벽 매뉴얼.",
  keywords: [
    "TNR 포획 방법", "포획틀 대여", "중성화 수술", "길고양이 포획",
    "통덫 사용법", "TNR 신청", "포획틀 설치", "중성화 병원",
    "길고양이 TNR 후기", "이어팁", "포획 후 관리",
  ],
  alternates: { canonical: "/protection/trapping-guide" },
  openGraph: {
    title: "길고양이 TNR 포획 방법 완벽 가이드 | 도시공존",
    description: "포획틀 대여부터 수술·재방사까지 TNR 전 과정을 이웃과 함께.",
  },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "길고양이 TNR 포획·수술·재방사 방법",
  description: "중성화(TNR)를 위한 안전한 포획 절차 및 수술 후 관리 전 과정",
  image: `${SITE_URL}/icons/icon-512.png`,
  totalTime: "P7D",
  supply: [
    { "@type": "HowToSupply", name: "포획틀(통덫)" },
    { "@type": "HowToSupply", name: "참치캔 또는 습식사료" },
    { "@type": "HowToSupply", name: "두꺼운 장갑" },
    { "@type": "HowToSupply", name: "큰 수건·담요" },
    { "@type": "HowToSupply", name: "신문지" },
  ],
  step: [
    { "@type": "HowToStep", name: "준비 — 구청·단체에 TNR 신청", text: "지자체 동물보호 부서에 TNR 신청. 무상 수술 쿠폰·포획틀 대여 받기." },
    { "@type": "HowToStep", name: "포획틀 설치", text: "밥자리 근처, 사람 눈에 잘 띄지 않는 곳. 신문지 깔고 입구 반대편에 미끼." },
    { "@type": "HowToStep", name: "대기·포획", text: "10m 이상 떨어져 관찰. 대부분 2~6시간 내 포획." },
    { "@type": "HowToStep", name: "포획 후 이송", text: "수건으로 틀을 덮어 안정 → 24시간 금식 후 수술 병원 이송." },
    { "@type": "HowToStep", name: "수술·회복", text: "중성화 수술 후 수컷 1일 / 암컷 3일 이상 실내 회복." },
    { "@type": "HowToStep", name: "재방사", text: "포획한 자리에 그대로 방사. 왼쪽 귀 끝 절단(이어팁)으로 재포획 방지." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "포획틀은 어디서 빌릴 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "거주지 관할 구청·시청 동물보호 부서에 TNR 신청을 하면 무상 대여해줍니다. 지역에 따라 2~14일 대여 가능. 대기가 길면 카라·동물자유연대 같은 단체에서도 빌려주고, 도시공존 커뮤니티 중고마켓에 '포획틀 대여' 글 올리는 이웃도 있어요.",
      },
    },
    {
      "@type": "Question",
      name: "TNR 비용은 얼마나 드나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "지자체 TNR 사업 쿠폰을 받으면 무료입니다. 사업 한도 소진 시 수컷 6~10만원, 암컷 10~15만원 수준이에요. 구청 접수 후 쿠폰 수령 → 지정 동물병원 이용이 일반적 절차입니다.",
      },
    },
    {
      "@type": "Question",
      name: "미끼는 뭐가 가장 효과적인가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "냄새가 강한 참치캔(오일이 적은 것), 고양이 습식캔, 익힌 닭가슴살이 일반적. 평소 주던 사료와 다른 맛이면 경계심 적고 들어갈 확률 ↑. 미끼는 입구 반대편 가장 깊숙한 곳에 놓아야 발판을 밟게 됩니다.",
      },
    },
    {
      "@type": "Question",
      name: "이어팁이 있는 고양이는 다시 포획해도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "안 됩니다. 왼쪽 귀 끝이 V자로 잘린 이어팁은 이미 중성화 완료 표시예요. 재포획은 스트레스만 줍니다. 포획틀에 이어팁 고양이가 들어오면 즉시 풀어주고 다음 대기 진행.",
      },
    },
    {
      "@type": "Question",
      name: "포획 후 몇 시간 안에 병원 가야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "수술은 보통 아침~오전에 진행되니 전날 저녁에 포획해 24시간 실내 금식 후 아침 수술이 일반적. 포획 상태에서 12시간 이상 방치하지 마세요. 스트레스·탈수 위험. 병원과 미리 수술 가능 날짜·시간 조율 필수.",
      },
    },
    {
      "@type": "Question",
      name: "수술 후 회복 기간은 얼마나 걸리나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "수컷은 24~48시간, 암컷은 3~5일 실내 회복이 표준. 상처 확인·감염 여부 체크 후 원래 자리로 방사. 암컷은 개복 수술이라 수컷보다 회복 기간이 깁니다. 회복 공간 없으면 도시공존 커뮤니티 임보에 도움 요청 가능.",
      },
    },
    {
      "@type": "Question",
      name: "포획틀에 들어간 고양이가 너무 스트레스 받아요. 풀어줘도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "수건·담요로 포획틀 전체를 덮어 시야를 가리면 빠르게 안정됩니다. 대부분 5~10분 내 얌전해져요. 풀어주면 TNR 기회를 잃고 번식 사이클이 계속되니, 수건 커버로 먼저 해결하세요. 단 부상이나 극심한 탈진이 보이면 즉시 풀어주고 응급 대응.",
      },
    },
    {
      "@type": "Question",
      name: "한 번에 여러 마리 포획할 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "포획틀 하나에 여러 마리가 들어가도 체격 차이로 눌림·부상 위험이 있어 권장하지 않습니다. 포획틀을 여러 개 동시에 설치하거나 한 마리 포획 후 즉시 다시 세팅하는 게 안전. 단 새끼와 어미는 함께 포획해야 합니다(새끼 혼자 두면 사망).",
      },
    },
  ],
};

export default function TrappingGuidePage() {
  return (
    <div className="px-5 pt-14 pb-16 max-w-[720px] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
          길고양이 TNR 포획 방법 — 포획틀 설치부터 방사까지
        </h1>
      </div>

      {/* 히어로 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #E8F4E8 0%, #D9EAD9 100%)",
          border: "1px solid rgba(107,142,111,0.2)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          <strong>TNR</strong>은 <em>Trap(포획) - Neuter(중성화) - Return(재방사)</em>의 줄임말.
          길고양이 개체수를 인도적으로 조절하는 유일한 방법이에요.
          <strong className="mx-1">포획만 잘못해도 스트레스로 사망</strong>할 수 있어 올바른 절차가 중요합니다.
          이 가이드는 <strong>신청 → 준비 → 설치 → 포획 → 수술 → 재방사</strong> 6단계 완전 매뉴얼입니다.
        </p>
        <p className="text-[11px] text-text-sub mt-3">
          마지막 업데이트: {LAST_UPDATED}
        </p>
      </div>

      {/* 왜 TNR? */}
      <section id="why" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Info size={20} color="#6B8E6F" />
          왜 TNR을 해야 하나요?
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          한 마리 암컷이 <strong>1년에 평균 10~12마리</strong> 출산하고, 그 새끼들이 다시 번식하면
          <strong className="mx-1">4년 만에 7만 마리</strong>까지 불어납니다. 개체수 폭증은 길고양이 개개의 복지를 떨어뜨리고
          주민 민원과 학대 사건의 원인이 돼요. TNR은:
        </p>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>개체수 증가 억제</strong> — 번식 사이클 끊기</li>
          <li><strong>발정기 소음·영역 다툼 감소</strong> — 주민 민원 완화</li>
          <li><strong>질병 감염 경로 차단</strong> — 교미·싸움 상처 감소</li>
          <li><strong>평균 수명 연장</strong> — 중성화 고양이는 약 2~3배 오래 삶</li>
          <li><strong>학대·포획 위협 감소</strong> — 개체수 줄면 주민 갈등 ↓</li>
        </ul>
      </section>

      {/* 목차 */}
      <nav
        aria-label="목차"
        className="rounded-2xl bg-white p-4 mb-6"
        style={{ border: "1px solid rgba(0,0,0,0.05)" }}
      >
        <p className="text-[11px] font-extrabold text-text-sub tracking-[0.1em] mb-2">목차</p>
        <ol className="text-[13px] space-y-1 text-text-main list-decimal pl-5">
          <li><a href="#step-1" className="hover:underline">1단계: 신청 — 구청 TNR 사업</a></li>
          <li><a href="#step-2" className="hover:underline">2단계: 준비물 체크리스트</a></li>
          <li><a href="#step-3" className="hover:underline">3단계: 포획틀 설치</a></li>
          <li><a href="#step-4" className="hover:underline">4단계: 대기·포획</a></li>
          <li><a href="#step-5" className="hover:underline">5단계: 수술·회복</a></li>
          <li><a href="#step-6" className="hover:underline">6단계: 재방사</a></li>
          <li><a href="#dont" className="hover:underline">절대 하지 말아야 할 행동</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* Step 1 */}
      <section id="step-1" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <span className="w-7 h-7 rounded-full bg-[#6B8E6F] text-white text-[12px] font-extrabold flex items-center justify-center">1</span>
          신청 — 구청 TNR 사업
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          대부분 지자체가 <strong>무상 TNR 사업</strong>을 운영합니다. 직접 포획·수술 비용 대지 말고 이걸 먼저 활용하세요.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">신청 절차</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li>거주지 <strong>시·구·군청 동물보호 부서</strong> 전화 또는 온라인 민원</li>
          <li>대략 위치, 추정 마릿수, 신청자 정보 제출</li>
          <li>포획틀 대여 + TNR 무상 쿠폰 수령 (며칠 소요)</li>
          <li>쿠폰 명시된 지정 동물병원에서 수술 예약</li>
        </ol>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#F6F1EA" }}>
          <p className="font-bold text-text-main mb-1">💡 지역 담당 부서</p>
          <p className="text-text-sub">
            도시공존의 <Link href="/protection/district-contacts" className="text-primary font-bold underline">시·구·군청 동물보호 담당부서</Link>에서
            전국 지자체 전화번호를 한눈에 볼 수 있어요.
          </p>
        </div>
      </section>

      {/* Step 2 */}
      <section id="step-2" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Package size={20} color="#5B7A8F" />
          <span className="w-7 h-7 rounded-full bg-[#5B7A8F] text-white text-[12px] font-extrabold flex items-center justify-center">2</span>
          준비물 체크리스트
        </h2>
        <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          {[
            { item: "포획틀(통덫)", note: "구청·단체 대여 또는 개인 소장자에게 빌리기" },
            { item: "참치캔·습식사료", note: "냄새 강한 것. 평소 안 주던 종류가 효과적" },
            { item: "두꺼운 장갑", note: "가죽 장갑 또는 원예용 장갑" },
            { item: "큰 수건·담요 2장", note: "포획 후 틀 덮기용·이송 시 보온용" },
            { item: "신문지 또는 방수 시트", note: "포획틀 아래에 깔아 배설물 흡수" },
            { item: "이동장·회복용 케이지", note: "수술 전후 임시 보호 공간" },
            { item: "라벨·표식", note: "여러 마리 포획 시 구분" },
          ].map((x, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-2.5"
              style={{ borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.05)" }}
            >
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "#6B8E6F" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-text-main">{x.item}</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">{x.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Step 3 */}
      <section id="step-3" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <MapPin size={20} color="#C47E5A" />
          <span className="w-7 h-7 rounded-full bg-[#C47E5A] text-white text-[12px] font-extrabold flex items-center justify-center">3</span>
          포획틀 설치
        </h2>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">설치 위치 고르기</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>평소 밥자리 근처</strong> — 이미 익숙한 장소가 경계심 ↓</li>
          <li><strong>벽이나 구조물 옆</strong> — 고양이가 등 뒤를 믿고 들어감</li>
          <li>사람 통행 적은 시간대에 설치 (저녁 8시 이후 권장)</li>
          <li>비·바람 막히는 곳 (포획틀 안정성 ↑)</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">설치 요령</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li>포획틀 아래에 <strong>신문지 또는 수건</strong> 깔기 — 바닥의 이상한 감촉을 가려줌</li>
          <li>입구 반대편 <strong>가장 깊숙한 곳</strong>에 미끼 놓기 (발판 위까지 들어가야 문 닫힘)</li>
          <li>미끼 주변·바닥에 <strong>파우더 형태 캣닢</strong> 살짝 뿌리기 (유인 효과 ↑)</li>
          <li>포획틀 상단을 어두운 천으로 살짝 덮기 (숨숨집 느낌)</li>
          <li>주변에 <strong>평소 먹이 그릇 치우기</strong> — 미끼만 먹게 유도</li>
        </ol>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#FDECEC", color: "#8B2F2F" }}>
          <p className="font-bold mb-1">⚠ 주의</p>
          <ul className="space-y-1 pl-4 list-disc">
            <li>다른 동물(너구리·개)이 접근 가능한 장소 피하기</li>
            <li>비 오는 날은 연기 — 물에 젖으면 저체온 위험</li>
            <li>기온 0℃ 이하에선 포획 후 방치되면 치명적 → 짧은 대기 필요</li>
          </ul>
        </div>
      </section>

      {/* Step 4 */}
      <section id="step-4" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Clock size={20} color="#7A6B8E" />
          <span className="w-7 h-7 rounded-full bg-[#7A6B8E] text-white text-[12px] font-extrabold flex items-center justify-center">4</span>
          대기·포획
        </h2>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>10m 이상 떨어져 관찰</strong> — 차 안이나 건물 창문에서 바라보면 좋음</li>
          <li>핸드폰 불빛도 끄고 가급적 조용히</li>
          <li>평균 <strong>2~6시간</strong> 내 포획. 경계심 높은 개체는 하루 이상 걸릴 수 있음</li>
          <li>6시간 지나도 포획 안 되면 <strong>위치·미끼 변경</strong> 고려</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">포획 성공 직후 (가장 중요)</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li>즉시 <strong>수건·담요로 포획틀 전체를 덮기</strong> — 시야 차단으로 5~10분 내 안정</li>
          <li>2~3분 기다린 후 조용히 접근. 말 걸지 말고 갑작스런 소음 금지</li>
          <li><strong>이어팁 확인</strong> — 왼쪽 귀 V자 잘림 있으면 이미 중성화된 개체. 즉시 풀어주기</li>
          <li>이어팁 없는 개체면 그대로 수술 병원까지 이송 (수건 덮은 상태 유지)</li>
          <li><strong>24시간 금식</strong>은 이미 시작. 물만 제공. 수술 마취 안전을 위해</li>
        </ol>
      </section>

      {/* Step 5 */}
      <section id="step-5" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Stethoscope size={20} color="#4A7BA8" />
          <span className="w-7 h-7 rounded-full bg-[#4A7BA8] text-white text-[12px] font-extrabold flex items-center justify-center">5</span>
          수술·회복
        </h2>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">병원에서의 처치</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>기초 건강 검사 (체중·심박·탈수 여부)</li>
          <li>중성화 수술 (약 30분~1시간)</li>
          <li>기생충 구충 (내·외부)</li>
          <li>예방접종 (지자체 지원 시)</li>
          <li><strong>왼쪽 귀 끝 V자 절단</strong> — 이어팁. 향후 재포획 방지용 표식</li>
          <li>마이크로칩 삽입 (지역·병원마다 다름)</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">회복 기간</h3>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: "#F6F1EA" }}>
              <tr>
                <th className="text-left px-3 py-2 font-bold">성별</th>
                <th className="text-left px-3 py-2 font-bold">실내 회복</th>
                <th className="text-left px-3 py-2 font-bold">특이사항</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <td className="px-3 py-2 font-semibold text-text-main">수컷</td>
                <td className="px-3 py-2 text-text-main">24~48시간</td>
                <td className="px-3 py-2 text-text-sub">간단한 음낭 수술</td>
              </tr>
              <tr style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <td className="px-3 py-2 font-semibold text-text-main">암컷</td>
                <td className="px-3 py-2 text-text-main">3~5일</td>
                <td className="px-3 py-2 text-text-sub">개복 수술, 상처 더 세심하게</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-text-sub mt-4 leading-relaxed">
          회복 공간이 없으면 도시공존 <Link href="/community/category/foster" className="text-primary font-bold underline">커뮤니티 임보</Link>에
          "TNR 회복 보호 구함" 글을 올려보세요. 이웃들이 도와줍니다.
        </p>
      </section>

      {/* Step 6 */}
      <section id="step-6" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Scissors size={20} color="#8B65B8" />
          <span className="w-7 h-7 rounded-full bg-[#8B65B8] text-white text-[12px] font-extrabold flex items-center justify-center">6</span>
          재방사
        </h2>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>포획한 바로 그 자리</strong>에 다시 풀어줘야 함. 낯선 곳은 생존 불가</li>
          <li>방사 시간은 <strong>해 질 무렵</strong>이 가장 안전 (야행성 적응 시간)</li>
          <li>평소 밥자리에 <strong>즐겨 먹는 사료</strong>를 놓아 복귀 유도</li>
          <li>며칠간 <strong>상태 관찰</strong> — 상처 감염·탈수 여부</li>
          <li>도시공존 지도에 <strong>이어팁 태그 추가</strong>해서 커뮤니티에 기록</li>
        </ul>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#E8F4E8", color: "#3F5B42" }}>
          <p className="font-bold mb-1">✅ 꾸준한 돌봄이 완성</p>
          <p>TNR은 끝이 아니라 시작. 재방사 후 <strong>정기적 급식·급수</strong>와 날씨 대응이 있어야 아이들이 건강하게 지낼 수 있어요.</p>
        </div>
      </section>

      {/* 하지 말아야 할 것 */}
      <section id="dont" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <AlertTriangle size={20} color="#D85555" />
          절대 하지 말아야 할 행동
        </h2>
        <div className="rounded-2xl p-4" style={{ background: "#FDECEC", border: "1px solid rgba(216,85,85,0.2)" }}>
          <ul className="text-[13.5px] space-y-2 pl-4 list-disc leading-relaxed" style={{ color: "#8B2F2F" }}>
            <li><strong>맨손 포획 시도</strong> — 물리면 Pasteurella 감염 위험</li>
            <li><strong>포획틀 방치</strong> — 2시간 이상 관찰 없이 두면 스트레스·탈수</li>
            <li><strong>수술 전 급식</strong> — 마취 중 구토로 흡인성 폐렴 위험</li>
            <li><strong>이어팁 고양이 재포획</strong> — 이미 수술된 개체, 무의미한 고통</li>
            <li><strong>낯선 장소 방사</strong> — 영역 다툼·아사 위험</li>
            <li><strong>수술 직후 24시간 내 방사</strong> — 마취 완전 깨기 전 위험</li>
            <li><strong>새끼 어미 분리 포획</strong> — 어린 새끼만 두고 어미만 포획 금지</li>
          </ul>
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
            href="/protection/district-contacts"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">시·구·군청 동물보호 담당부서</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">TNR 신청·포획틀 대여</p>
            </div>
          </Link>
          <Link
            href="/protection/kitten-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">🐱</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">새끼 고양이(냥줍) 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">어린 아이 발견했을 때</p>
            </div>
          </Link>
          <Link
            href="/protection/emergency-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">🚨</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">응급 구조 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">다친 길고양이 대응법</p>
            </div>
          </Link>
          <Link
            href="/hospitals"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <Stethoscope size={18} color="#6B8E6F" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">구조동물 치료 병원</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">TNR 지정 병원 목록</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 신뢰 출처 */}
      <section className="mb-8 rounded-2xl p-4" style={{ background: "#F6F1EA", border: "1px solid rgba(0,0,0,0.04)" }}>
        <h3 className="text-[13px] font-bold text-text-main mb-2">참고한 출처</h3>
        <ul className="text-[12px] text-text-sub space-y-1 pl-4 list-disc leading-relaxed">
          <li>농림축산식품부 길고양이 TNR 사업 지침</li>
          <li>서울특별시 동물보호과 TNR 사업 안내</li>
          <li>카라(KARA) TNR 매뉴얼</li>
          <li>한국고양이수의사회 수술 가이드라인</li>
        </ul>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          이 가이드는 일반 TNR 참고용이며 <strong>지자체 지침·병원 안내를 우선해주세요</strong>.
          포획·수술 과정에서 문제 발생 시 반드시 수의사·구청 담당자에게 문의하세요.
        </p>
      </section>
    </div>
  );
}
