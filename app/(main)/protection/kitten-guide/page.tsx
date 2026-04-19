import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Eye, Thermometer, Milk, Stethoscope, Home, HelpCircle,
  AlertTriangle, Clock, Heart, BookOpen,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "새끼 고양이(냥줍) 발견했을 때 완벽 가이드",
  description:
    "길에서 새끼 고양이를 발견했을 때 해야 할 행동 6단계. 관찰·체온 유지·KMR 분유 급여·응급 병원 방문·입양까지. 초보자도 바로 따라할 수 있는 완벽 매뉴얼.",
  keywords: [
    "새끼 고양이 발견", "냥줍", "냥줍 방법", "고양이 분유", "KMR",
    "아기 고양이 돌봄", "새끼 고양이 체온", "갓난 고양이", "고양이 분유 간격",
    "어미 고양이 기다리기", "아기 길고양이",
  ],
  alternates: { canonical: "/protection/kitten-guide" },
  openGraph: {
    title: "새끼 고양이(냥줍) 발견했을 때 완벽 가이드 | 도시공존",
    description: "관찰·보온·KMR 분유·병원 방문까지 단계별 완전 매뉴얼. 초보자 필수.",
  },
};

// HowTo JSON-LD (구글 구조화 데이터)
const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "길에서 새끼 고양이(냥줍)를 발견했을 때 대응 방법",
  description:
    "야생에서 발견한 어린 고양이에 대한 안전한 대응 절차. 관찰부터 구조, 급여, 병원 방문까지.",
  image: `${SITE_URL}/icons/icon-512.png`,
  totalTime: "PT3H",
  supply: [
    { "@type": "HowToSupply", name: "수건 또는 담요" },
    { "@type": "HowToSupply", name: "고양이 전용 분유(KMR)" },
    { "@type": "HowToSupply", name: "젖병 또는 주사기" },
    { "@type": "HowToSupply", name: "핫팩" },
    { "@type": "HowToSupply", name: "이동장 또는 박스" },
  ],
  step: [
    { "@type": "HowToStep", name: "2~3시간 관찰하기", text: "엄마 고양이가 돌아올 수 있으니 최소 2~3시간은 멀리서 관찰합니다." },
    { "@type": "HowToStep", name: "위험 신호 판단", text: "피 흘림·기력 없음·극심한 추위 등 긴급 상황인지 판단합니다." },
    { "@type": "HowToStep", name: "체온 유지", text: "수건으로 감싸고 핫팩을 수건 위에 올려 따뜻하게 유지합니다." },
    { "@type": "HowToStep", name: "KMR 분유 급여", text: "우유는 절대 금지. 고양이 전용 분유(KMR)를 2~3시간 간격으로 급여합니다." },
    { "@type": "HowToStep", name: "동물병원 방문", text: "24시간 내 건강 체크·탈수 여부 확인을 위해 병원을 방문합니다." },
    { "@type": "HowToStep", name: "입양·임보 결정", text: "본인이 돌볼지, 임보·입양을 구할지 결정합니다." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "엄마 고양이가 잠시 떠난 건지 버린 건지 어떻게 알아요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "2~3시간 관찰이 기본입니다. 엄마 고양이는 보통 1~2시간 내 돌아옵니다. 새끼들이 울지 않고 한 곳에 모여있다면 엄마가 근처에서 지켜보고 있을 확률이 높아요. 반대로 24시간 이상 엄마가 없고 새끼들이 흩어져 울고 있으면 구조가 필요합니다.",
      },
    },
    {
      "@type": "Question",
      name: "눈도 안 뜬 아주 어린 새끼를 발견했어요. 어떻게 해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "생후 10일 이내(눈 감긴 상태)는 체온과 분유 급여가 2~3시간 간격으로 필요해 돌봄 난이도가 매우 높습니다. 즉시 동물병원에 연락하고, 임시 보온을 한 뒤 경험자 또는 구조단체의 도움을 받으세요. 도시공존 커뮤니티의 임보 카테고리에 도움을 요청해도 됩니다.",
      },
    },
    {
      "@type": "Question",
      name: "우유를 주면 왜 안 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "고양이 대부분은 유당불내증이 있어 우유를 소화하지 못합니다. 설사·탈수로 이어져 치명적일 수 있어요. 반드시 고양이 전용 분유(KMR 또는 동등 제품)를 사용해야 합니다. 응급 시 임시로 쌀뜨물·따뜻한 물은 가능하지만 빠른 시간 내 분유로 전환해야 합니다.",
      },
    },
    {
      "@type": "Question",
      name: "냥줍하면 꼭 평생 책임져야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "꼭 그런 건 아닙니다. 초기 구조 후 임시보호→입양 절차로 새 가족을 찾아줄 수 있어요. 단 책임지기 어렵다면 처음부터 함부로 데려오지 마세요. 데려온 이상 최소 수주간의 보호·병원비·분유값은 필요합니다.",
      },
    },
    {
      "@type": "Question",
      name: "어미 고양이가 공격해서 새끼를 가까이 못 가요.",
      acceptedAnswer: {
        "@type": "Answer",
        text: "어미의 경계는 자식을 지키려는 본능입니다. 무리해서 만지지 말고, 어미가 자리를 비운 틈에만 급여·청소를 해주세요. 어미가 새끼를 보호하고 있다면 억지 구조는 오히려 해가 됩니다. 조용히 사료·물·집 정도만 지원하는 게 현명합니다.",
      },
    },
    {
      "@type": "Question",
      name: "새끼를 만지면 엄마가 버린다는 말이 사실인가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "부분적 사실입니다. 사람 냄새가 묻으면 어미가 경계를 강화할 수는 있지만 반드시 버리는 건 아니에요. 가능하면 만지지 않는 게 좋지만, 생명 위협 상황(저체온·부상)에서는 체온 유지를 우선시해야 합니다.",
      },
    },
    {
      "@type": "Question",
      name: "KMR 분유는 어디서 사나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "동물병원·대형 반려동물 전문점·온라인 쇼핑몰에서 구할 수 있습니다. 응급 상황이면 24시간 동물병원에 연락하면 소량 분양해주기도 합니다. 비상용으로 평소 한 팩 정도 구비해두면 좋아요.",
      },
    },
    {
      "@type": "Question",
      name: "병원비가 부담됩니다. 도와주는 곳이 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "도시공존의 '구조동물 치료 도움병원' 목록에서 할인·분할결제 가능한 병원을 찾을 수 있어요. 또한 카라·동물자유연대 등 단체에서 비용 일부 지원 캠페인을 운영할 때가 있으니 문의해보세요.",
      },
    },
  ],
};

export default function KittenGuidePage() {
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
          새끼 고양이(냥줍) 발견했을 때 완벽 가이드
        </h1>
      </div>

      {/* 히어로 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #FFF9E8 0%, #FFF3CC 100%)",
          border: "1px solid rgba(201,169,97,0.2)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          길에서 우는 아기 고양이를 발견했을 때, 가장 먼저 해야 할 일은
          <strong className="mx-1">데려오는 게 아니라 관찰</strong>입니다.
          어미가 잠시 자리를 비운 것이라면 사람이 개입하는 순간
          가족이 흩어지게 돼요. 이 가이드는 발견부터 구조·보온·급여·병원 방문까지
          <strong className="mx-1">6단계</strong>로 나눠서 설명합니다.
          상황이 급하면 중간의 <a href="#step-2" className="text-primary font-bold underline">위험 신호 판단</a> 섹션을 먼저 확인하세요.
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
          <li><a href="#step-1" className="hover:underline">관찰 — 왜 바로 데려가면 안 되나</a></li>
          <li><a href="#step-2" className="hover:underline">위험 신호 판단 — 즉시 구조가 필요한 7가지</a></li>
          <li><a href="#step-3" className="hover:underline">체온 유지 — 36.5도 만들기</a></li>
          <li><a href="#step-4" className="hover:underline">KMR 분유 급여 — 절대 우유 금지</a></li>
          <li><a href="#step-5" className="hover:underline">동물병원 방문 — 24시간 내</a></li>
          <li><a href="#step-6" className="hover:underline">입양·임보 결정</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* Step 1 */}
      <section id="step-1" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <span className="w-7 h-7 rounded-full bg-[#C9A961] text-white text-[12px] font-extrabold flex items-center justify-center">1</span>
          관찰 — 왜 바로 데려가면 안 되나
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          야생 고양이 어미는 먹이를 구하러 <strong>1~2시간씩 자리를 비우는 게 정상</strong>입니다.
          이 시간에 우는 아기 고양이를 사람이 데려가면, 어미와 영원히 이별시키는 결과가 됩니다.
          어미 젖은 분유보다 영양가·면역력이 훨씬 뛰어나서 생존율 차이가 큽니다.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">관찰 원칙 3가지</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>최소 2~3시간 멀리서 관찰</strong> — 어미 고양이는 근처 숨어 사람을 지켜보고 있을 가능성이 큽니다.</li>
          <li><strong>사람 냄새 최소화</strong> — 손을 대지 마세요. 어미가 새끼를 포기하진 않지만 경계가 강해져 급여 거부로 이어질 수 있어요.</li>
          <li><strong>소리·빛 자극 금지</strong> — 후레시, 큰 소리는 어미를 쫓아냅니다. 조용히 거리를 두고 지켜보세요.</li>
        </ul>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#F6F1EA" }}>
          <p className="font-bold text-text-main mb-1">💡 TIP — 어미가 있는 신호</p>
          <ul className="space-y-1 text-text-sub pl-4 list-disc">
            <li>새끼들이 울지 않고 모여있다</li>
            <li>주변에 어미 털·배변 흔적이 있다</li>
            <li>배가 빵빵하고 몸이 따뜻하다 (최근 급여됨)</li>
          </ul>
        </div>
      </section>

      {/* Step 2 */}
      <section id="step-2" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <span className="w-7 h-7 rounded-full bg-[#D85555] text-white text-[12px] font-extrabold flex items-center justify-center">2</span>
          위험 신호 — 즉시 구조가 필요한 7가지
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          아래 신호 중 하나라도 해당되면 <strong>관찰 없이 즉시 구조</strong>해야 합니다.
          분 단위로 생존이 위협받는 상황이에요.
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E8C5C5" }}>
          {[
            { icon: "🩸", text: "피를 흘리거나 깊은 상처가 있다" },
            { icon: "❄️", text: "기온 5℃ 이하이고 몸이 차갑다" },
            { icon: "💧", text: "비·눈에 흠뻑 젖어있다" },
            { icon: "😿", text: "눈곱·콧물이 심하고 호흡이 거칠다" },
            { icon: "🦟", text: "파리·개미가 모여들어 있다" },
            { icon: "🏚️", text: "위험한 장소(도로·공사장·하수구)에 있다" },
            { icon: "💀", text: "어미로 보이는 개체가 이미 사망 상태다" },
          ].map((r) => (
            <div
              key={r.text}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: "rgba(216,85,85,0.15)", background: "#FBEAEA" }}
            >
              <span className="text-[18px]">{r.icon}</span>
              <span className="text-[13.5px] font-semibold text-text-main">{r.text}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-text-sub mt-3 leading-relaxed">
          긴급 구조 시 가까운 동물병원 또는 <strong>동물보호상담센터(1577-0954)</strong>로 연락하세요.
          도시공존 앱의 <Link href="/hospitals" className="text-primary underline font-bold">구조동물 치료 병원</Link> 목록에서도 가까운 병원을 찾을 수 있습니다.
        </p>
      </section>

      {/* Step 3 */}
      <section id="step-3" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Thermometer size={20} color="#C47E5A" />
          <span className="w-7 h-7 rounded-full bg-[#C47E5A] text-white text-[12px] font-extrabold flex items-center justify-center">3</span>
          체온 유지 — 36.5도 만들기
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          새끼 고양이는 생후 3~4주까지 스스로 체온을 조절하지 못해요.
          <strong>저체온증은 탈수·저혈당보다 더 빠르게 사망에 이르는 원인</strong>입니다.
          구조 직후 가장 먼저 해야 할 일이 보온입니다.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">보온 3단계</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li><strong>수건으로 감싸기</strong> — 마른 수건으로 몸을 감싸 체온 손실 차단. 젖어있다면 새 수건으로 먼저 말립니다.</li>
          <li><strong>핫팩은 간접 열원으로</strong> — 핫팩을 수건에 싸서 박스 구석에 두세요. 직접 닿으면 저온 화상 위험. 반대편에 찬 공간도 만들어 아기가 피할 수 있게 합니다.</li>
          <li><strong>체온계로 확인</strong> — 36.5~38.5℃가 정상. 36℃ 이하면 저체온증, 39℃ 이상이면 고열·감염 의심. 둘 다 병원 직행.</li>
        </ol>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#FDECEC", color: "#8B2F2F" }}>
          <p className="font-bold mb-1">⚠ 주의 — 금지 행동</p>
          <ul className="space-y-1 pl-4 list-disc">
            <li>뜨거운 물에 담그기 (쇼크 위험)</li>
            <li>드라이어로 말리기 (화상·호흡기 자극)</li>
            <li>전자레인지에 데운 수건 (온도 조절 불가)</li>
          </ul>
        </div>
      </section>

      {/* Step 4 */}
      <section id="step-4" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Milk size={20} color="#6B8E6F" />
          <span className="w-7 h-7 rounded-full bg-[#6B8E6F] text-white text-[12px] font-extrabold flex items-center justify-center">4</span>
          KMR 분유 급여 — 절대 우유 금지
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          <strong>우유는 설사·탈수로 새끼를 죽일 수 있습니다.</strong>
          유당불내증 때문에요. 반드시 <strong>고양이 전용 분유(KMR)</strong> 또는 동등한 대용분유를 사용해야 합니다.
          응급 시 임시로 쌀뜨물·따뜻한 물 한 티스푼 정도는 가능하지만, 분유를 최우선 구해야 해요.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">연령별 급여량·간격</h3>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: "#F6F1EA" }}>
              <tr>
                <th className="text-left px-3 py-2 font-bold">연령</th>
                <th className="text-left px-3 py-2 font-bold">간격</th>
                <th className="text-left px-3 py-2 font-bold">1회 급여량</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1주 이하", "2시간", "2~4ml"],
                ["1~2주", "3시간", "5~7ml"],
                ["2~3주", "4시간", "7~10ml"],
                ["3~4주", "5시간", "10~14ml"],
                ["4주 이상", "이유식 병행", "사료 + 분유"],
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  {row.map((c, j) => (
                    <td key={j} className="px-3 py-2 text-text-main">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">급여 방법</h3>
        <ol className="text-[13.5px] text-text-main space-y-2 pl-5 list-decimal leading-relaxed">
          <li>분유를 체온 정도(38℃)로 데워요. 전자레인지 금지 — 따뜻한 물에 중탕으로.</li>
          <li>새끼를 <strong>엎드린 자세</strong>로 눕히고 (사람 아기처럼 눕히면 폐에 들어갈 수 있음) 젖병을 물려요.</li>
          <li>한 번에 많이 주지 말고, 위의 표대로 소량을 자주.</li>
          <li>급여 후 따뜻한 물수건으로 <strong>엉덩이 자극</strong> — 어미가 핥아서 배변 유도하는 역할. 하루 3~5회 필수.</li>
          <li>배변 색·냄새 체크. 노란 설사면 바로 병원.</li>
        </ol>
      </section>

      {/* Step 5 */}
      <section id="step-5" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Stethoscope size={20} color="#4A7BA8" />
          <span className="w-7 h-7 rounded-full bg-[#4A7BA8] text-white text-[12px] font-extrabold flex items-center justify-center">5</span>
          동물병원 방문 — 24시간 내
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          겉보기엔 멀쩡해 보여도 <strong>기생충·탈수·호흡기 감염은 육안으로 보이지 않습니다</strong>.
          구조 후 24시간 내 병원 방문으로 기초 건강 상태를 확인하세요.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">병원에서 하는 검사·처치</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>체중·체온 측정 (기준치 비교)</li>
          <li>기생충 검사 및 구충 (회충·벼룩·진드기)</li>
          <li>탈수 여부 확인 + 필요 시 수액</li>
          <li>범백(FPV) 감염 여부 확인</li>
          <li>체온 안정화 후 보호 지침 안내</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">예상 비용</h3>
        <p className="text-[13.5px] text-text-main leading-relaxed">
          기초 검진 <strong>3~7만원</strong>, 범백 키트 1~2만원, 구충제 1~2만원, 수액 처치 시 3~5만원 추가.
          총 <strong>5~15만원</strong> 수준. 구조묘 할인을 제공하는 병원도 있으니
          <Link href="/hospitals" className="text-primary font-bold underline ml-1">구조동물 치료 병원</Link>
          목록을 확인하세요.
        </p>
      </section>

      {/* Step 6 */}
      <section id="step-6" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Home size={20} color="#8B65B8" />
          <span className="w-7 h-7 rounded-full bg-[#8B65B8] text-white text-[12px] font-extrabold flex items-center justify-center">6</span>
          입양·임보 결정
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          건강이 안정되면 <strong>본인이 평생 돌볼지, 새 가족을 찾아줄지</strong> 결정해야 합니다.
          냥줍 후 부담돼 유기·방치로 이어지는 경우가 많아 신중히 판단하세요.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">직접 돌보기 체크리스트</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>향후 <strong>15~20년</strong> 평생 책임 의지</li>
          <li>초기 비용 30~50만원 감당 가능 (병원·용품)</li>
          <li>월 5~10만원 고정 지출 여력 (사료·모래·예방접종)</li>
          <li>가족 모두 알레르기·반대 없음</li>
          <li>이사 계획 시 반려동물 동반 가능 주거</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-5 mb-2">임보·입양 구하는 법</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>도시공존 커뮤니티 <Link href="/community/category/foster" className="text-primary font-bold underline">임보</Link>·<Link href="/community/category/adoption" className="text-primary font-bold underline">입양</Link> 카테고리에 글 올리기</li>
          <li>네이버 카페 (고양이라서 다행이야, 냥이네 등) 활용</li>
          <li>카라·동물자유연대 구조 공고 페이지</li>
          <li>지역 맘카페·당근마켓 동네생활</li>
        </ul>
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
            <AlertTriangle size={18} color="#D85555" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">길고양이 응급 구조 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">성묘가 다쳤을 때 대응법</p>
            </div>
          </Link>
          <Link
            href="/protection/trapping-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <Clock size={18} color="#E88D5A" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">TNR 포획 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">중성화 수술을 위한 안전한 포획</p>
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
              <p className="text-[11.5px] text-text-sub mt-0.5">할인·지원되는 동물병원 목록</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 신뢰 출처 */}
      <section className="mb-8 rounded-2xl p-4" style={{ background: "#F6F1EA", border: "1px solid rgba(0,0,0,0.04)" }}>
        <h3 className="text-[13px] font-bold text-text-main mb-2 flex items-center gap-1.5">
          <Heart size={14} color="#C47E5A" />
          참고한 출처
        </h3>
        <ul className="text-[12px] text-text-sub space-y-1 pl-4 list-disc leading-relaxed">
          <li>동물보호관리시스템 (농림축산식품부)</li>
          <li>카라(KARA) 새끼 고양이 구조 매뉴얼</li>
          <li>동물자유연대 길고양이 보호 가이드</li>
          <li>한국고양이수의사회 응급처치 가이드라인</li>
        </ul>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          이 가이드는 일반 돌봄 참고용이며 <strong>수의사의 진단·처방을 대체하지 않습니다</strong>.
          위급 상황에서는 반드시 동물병원·동물보호상담센터(1577-0954)에 연락하세요.
        </p>
      </section>
    </div>
  );
}
