import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, Shield, Stethoscope, Phone, Car,
  HelpCircle, BookOpen, Flame, Droplet,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 응급 구조·응급처치 완벽 가이드",
  description:
    "다친 길고양이를 발견했을 때 안전하게 구조하는 방법. 로드킬·출혈·골절·경련·중독 상황별 대응. 24시간 동물병원 연결·신고 전화번호 전부 정리.",
  keywords: [
    "길고양이 응급처치", "길고양이 구조 방법", "로드킬 대응", "고양이 출혈",
    "고양이 골절", "중독된 고양이", "24시간 동물병원", "동물보호상담센터",
    "다친 길고양이", "길고양이 응급 이송", "고양이 구조 신고",
  ],
  alternates: { canonical: "/protection/emergency-guide" },
  openGraph: {
    title: "길고양이 응급 구조·응급처치 완벽 가이드 | 도시공존",
    description: "로드킬·출혈·골절·중독 상황별 대응. 안전하게 구조하고 병원으로 이송하는 방법.",
  },
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "길에서 다친 길고양이를 구조하는 방법",
  description: "안전 확보부터 응급처치, 병원 이송까지 단계별 가이드",
  image: `${SITE_URL}/icons/icon-512.png`,
  totalTime: "PT1H",
  supply: [
    { "@type": "HowToSupply", name: "두꺼운 장갑 또는 수건" },
    { "@type": "HowToSupply", name: "이동장 또는 큰 상자" },
    { "@type": "HowToSupply", name: "담요·수건" },
    { "@type": "HowToSupply", name: "깨끗한 거즈 또는 천" },
    { "@type": "HowToSupply", name: "생수(상처 세척용)" },
  ],
  step: [
    { "@type": "HowToStep", name: "안전 확보", text: "차도라면 교통 유도부터. 두꺼운 장갑 착용 후 접근." },
    { "@type": "HowToStep", name: "상태 파악", text: "의식·호흡·출혈·골절 여부를 5초 내 판단." },
    { "@type": "HowToStep", name: "응급처치", text: "출혈은 압박, 골절은 고정. 사람용 약 절대 금지." },
    { "@type": "HowToStep", name: "안전 이송", text: "담요로 감싸 이동장에 넣고 24시간 동물병원으로." },
    { "@type": "HowToStep", name: "신고·공유", text: "동물보호상담센터 1577-0954. 학대 정황이면 112." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "다친 길고양이에게 사람용 진통제를 먹여도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "절대 금지입니다. 아세트아미노펜(타이레놀)은 소량만으로도 고양이에게 치명적이에요. 이부프로펜·아스피린도 마찬가지. 응급 시에도 반드시 수의사 처방을 받아야 하며, 임시로 할 수 있는 건 체온 유지와 조용한 환경 제공뿐입니다.",
      },
    },
    {
      "@type": "Question",
      name: "24시간 동물병원이 너무 멀어요. 어떻게 해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "동물보호상담센터(1577-0954)에 연락하면 근처 응급 가능 병원·수의사 당직 정보를 안내해줍니다. 도시공존 앱의 '구조동물 치료 병원' 목록에도 24시간 운영 표시된 곳이 있으니 확인하세요. 이송 중에는 체온 유지가 최우선입니다.",
      },
    },
    {
      "@type": "Question",
      name: "고양이가 경련을 일으키고 있어요. 어떻게 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "중독 또는 발작 가능성이 높습니다. 손으로 만지지 말고 주변의 딱딱한 물건을 치워 부상을 예방하세요. 경련이 멎으면 담요로 감싸 즉시 병원으로. 구토물·먹던 음식이 있다면 샘플을 챙겨가면 진단에 도움이 됩니다.",
      },
    },
    {
      "@type": "Question",
      name: "이미 사망한 길고양이를 발견했을 때 어떻게 해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "관할 구청·시청 환경과 또는 120 다산콜센터(서울), 지역별 120에 연락하면 사체 수습을 진행합니다. 도로 위 로드킬은 도로관리청(1577-2504) 신고 가능. 개인이 직접 수습은 전염병 위험 있으니 피하세요.",
      },
    },
    {
      "@type": "Question",
      name: "학대 정황이 보이는 현장을 목격했어요",
      acceptedAnswer: {
        "@type": "Answer",
        text: "즉시 112 신고가 원칙입니다. 동물보호법 제8조 위반은 형사처벌 대상(3년 이하 징역, 3천만 원 이하 벌금). 증거 확보가 중요하니 안전한 거리에서 사진·동영상 촬영, 장소·시간 기록. 도시공존 지도에서 학대 경보를 남기면 이웃들이 함께 주의하게 됩니다.",
      },
    },
    {
      "@type": "Question",
      name: "고양이가 물렸어요. 제가 병원 가야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "반드시 가야 합니다. 고양이 구강 세균은 사람에게 Pasteurella 감염을 일으켜 농양·봉와직염 위험. 상처를 흐르는 물+비누로 5분 이상 세척, 소독 후 가까운 병원에서 파상풍 주사·항생제 처방 받으세요. 발적·열감·부기가 심하면 즉시 응급실.",
      },
    },
    {
      "@type": "Question",
      name: "포획이 어려워요. 포획틀을 쓰면 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "포획틀(통덫)은 TNR 목적이 기본이고 응급 구조에도 사용 가능합니다. 시청에 대여 신청하거나 도시공존 커뮤니티에서 빌리는 분들도 있어요. 구체적 사용법은 'TNR 포획 가이드' 페이지를 참고하세요. 단 긴급한 부상 상황에서는 포획틀이 느릴 수 있어 직접 담요로 감싸는 게 더 빠를 수 있습니다.",
      },
    },
    {
      "@type": "Question",
      name: "병원비를 감당하기 어려워요",
      acceptedAnswer: {
        "@type": "Answer",
        text: "도시공존의 '구조동물 치료 도움병원' 목록에서 구조묘 할인·분할결제 가능한 병원을 찾을 수 있어요. 카라(KARA)·동물자유연대 같은 단체에서 구조비 지원 캠페인을 운영하기도 합니다. 커뮤니티 '긴급' 카테고리에 상황을 올리면 이웃들이 십시일반으로 돕는 경우도 많아요.",
      },
    },
  ],
};

const EMERGENCY_SIGNS = [
  { emoji: "🩸", title: "대량 출혈", desc: "분홍빛 이상 피가 흐르거나 옷·지면에 번질 정도" },
  { emoji: "🤕", title: "골절·움직임 이상", desc: "다리 각도가 부자연스럽거나 한쪽을 전혀 못 씀" },
  { emoji: "😵", title: "의식 저하", desc: "불러도 반응 없거나 혀가 빠져나와 있음" },
  { emoji: "💨", title: "호흡 곤란", desc: "입을 벌리고 숨 쉼, 가슴 들썩임이 비정상적" },
  { emoji: "🌀", title: "경련·발작", desc: "온 몸이 떨리거나 다리가 뻣뻣해져 있음" },
  { emoji: "🤮", title: "중독 의심", desc: "입에 거품, 반복 구토, 설사 + 기력 소실" },
  { emoji: "❄️", title: "저체온", desc: "겨울철 움직임 둔하고 몸이 차갑다" },
  { emoji: "🔥", title: "화상·열상", desc: "털이 탔거나 피부가 짓물러 있음" },
];

export default function EmergencyGuidePage() {
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
          길고양이 응급 구조·응급처치 완벽 가이드
        </h1>
      </div>

      {/* 긴급 전화 — 항상 가장 위 */}
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
            위급 상황 시 바로 연락
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a
            href="tel:112"
            className="rounded-xl bg-white p-3 flex flex-col items-center active:scale-95"
            style={{ border: "1px solid rgba(216,85,85,0.15)" }}
          >
            <span className="text-[18px]">🚔</span>
            <p className="text-[10px] text-text-sub mt-1">학대·범죄 신고</p>
            <p className="text-[14px] font-extrabold" style={{ color: "#B84545" }}>112</p>
          </a>
          <a
            href="tel:1577-0954"
            className="rounded-xl bg-white p-3 flex flex-col items-center active:scale-95"
            style={{ border: "1px solid rgba(216,85,85,0.15)" }}
          >
            <span className="text-[18px]">🐾</span>
            <p className="text-[10px] text-text-sub mt-1">동물보호상담</p>
            <p className="text-[13px] font-extrabold" style={{ color: "#B84545" }}>1577-0954</p>
          </a>
          <a
            href="tel:1577-2504"
            className="rounded-xl bg-white p-3 flex flex-col items-center active:scale-95"
            style={{ border: "1px solid rgba(216,85,85,0.15)" }}
          >
            <span className="text-[18px]">🚧</span>
            <p className="text-[10px] text-text-sub mt-1">도로 로드킬</p>
            <p className="text-[13px] font-extrabold" style={{ color: "#B84545" }}>1577-2504</p>
          </a>
        </div>
      </div>

      {/* 히어로 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #FFF4E8 0%, #FFE8D1 100%)",
          border: "1px solid rgba(184,69,69,0.15)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          다친 길고양이를 발견했을 때 가장 큰 실수는 <strong>겁먹고 아무것도 안 하거나, 반대로 맨손으로 덥썩 안는 것</strong>이에요.
          고양이는 통증·공포 상태에서 가족이든 구조자든 가리지 않고 물고 할퀼 수 있어 본인도 부상당합니다.
          이 가이드는 <strong>안전 확보 → 상태 판단 → 응급처치 → 이송 → 사후 조치</strong> 5단계로
          현장에서 바로 따라할 수 있는 실전 매뉴얼입니다.
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
          <li><a href="#signs" className="hover:underline">위급 신호 8가지 — 즉시 병원</a></li>
          <li><a href="#step-1" className="hover:underline">1단계: 안전 확보</a></li>
          <li><a href="#step-2" className="hover:underline">2단계: 상태 파악 (5초 체크)</a></li>
          <li><a href="#step-3" className="hover:underline">3단계: 응급처치 (상황별)</a></li>
          <li><a href="#step-4" className="hover:underline">4단계: 안전 이송</a></li>
          <li><a href="#step-5" className="hover:underline">5단계: 사후 조치·신고</a></li>
          <li><a href="#dont" className="hover:underline">절대 하지 말아야 할 행동</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 위급 신호 */}
      <section id="signs" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <AlertTriangle size={20} color="#D85555" />
          위급 신호 8가지 — 즉시 병원
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          아래 중 <strong>하나라도 해당되면 관찰·판단 스킵하고 바로 병원</strong>으로. 분 단위 생존율입니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_SIGNS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl p-3"
              style={{ background: "#FBEAEA", border: "1px solid rgba(216,85,85,0.15)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                <span className="text-[12.5px] font-extrabold" style={{ color: "#8B2F2F" }}>
                  {s.title}
                </span>
              </div>
              <p className="text-[11px] text-text-sub leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Step 1 */}
      <section id="step-1" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Shield size={20} color="#B84545" />
          <span className="w-7 h-7 rounded-full bg-[#B84545] text-white text-[12px] font-extrabold flex items-center justify-center">1</span>
          안전 확보
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          구조자가 다치면 고양이도 같이 못 구합니다. <strong>본인 안전이 1순위</strong>예요.
        </p>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">차도·위험 지역이라면</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>차량 대피 공간 먼저 확보 — <strong>반드시 비상등</strong> 켜고 안전 삼각대 설치</li>
          <li>동행자가 있으면 한 명은 교통 유도, 다른 한 명이 접근</li>
          <li>야간이면 전조등이나 핸드폰 손전등 켜 드라이버에게 가시 확보</li>
        </ul>
        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">고양이에게 접근할 때</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>두꺼운 장갑 착용</strong> — 통증·공포 상태의 고양이는 가족·구조자 가리지 않고 뭅니다</li>
          <li>또는 수건·담요로 <strong>손과 팔을 감싼</strong> 뒤 접근</li>
          <li>천천히 낮은 자세로, 조용한 목소리로 "괜찮아" 같은 단어 반복</li>
          <li>위에서 덮치는 모양 금지 — 아래에서 위로 다가가기</li>
        </ul>
      </section>

      {/* Step 2 */}
      <section id="step-2" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Stethoscope size={20} color="#4A7BA8" />
          <span className="w-7 h-7 rounded-full bg-[#4A7BA8] text-white text-[12px] font-extrabold flex items-center justify-center">2</span>
          상태 파악 (5초 체크)
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          의사결정에 쓸 시간은 길지 않아요. <strong>5초 내</strong> 네 가지를 빠르게 확인하세요.
        </p>
        <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
          <table className="w-full text-[13px]">
            <thead style={{ background: "#F6F1EA" }}>
              <tr>
                <th className="text-left px-3 py-2 font-bold">체크 항목</th>
                <th className="text-left px-3 py-2 font-bold">판단</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["의식 (부르면 반응)", "없으면 → 최우선 이송"],
                ["호흡 (가슴 들썩임)", "불규칙·느리면 → 심폐 위험"],
                ["출혈 (빨간 얼룩 있나)", "대량이면 → 압박 후 이송"],
                ["움직임 (다리 반응)", "한쪽 못 씀 → 골절 의심"],
              ].map(([k, v], i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <td className="px-3 py-2 font-semibold text-text-main">{k}</td>
                  <td className="px-3 py-2 text-text-sub">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-text-sub leading-relaxed">
          몸을 만지기 전에 <strong>눈으로만 우선 확인</strong>하세요. 통증 부위 잘못 건드리면 쇼크 올 수 있어요.
        </p>
      </section>

      {/* Step 3 */}
      <section id="step-3" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Droplet size={20} color="#C47E5A" />
          <span className="w-7 h-7 rounded-full bg-[#C47E5A] text-white text-[12px] font-extrabold flex items-center justify-center">3</span>
          응급처치 (상황별)
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          가능한 처치와 해선 안 되는 처치를 혼동하지 마세요. <strong>"이송을 위한 최소한의 안정"</strong>이 목표지, 치료가 아닙니다.
        </p>

        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">🩸 출혈</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>깨끗한 천·거즈로 <strong>상처 부위를 직접 압박</strong> (2~3분)</li>
          <li>지혈되지 않으면 위쪽으로 천을 덧대며 계속 압박 (기존 거즈 떼지 말기)</li>
          <li>지혈대는 금물 — 혈액 순환 완전 차단되면 조직 괴사</li>
        </ul>

        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">🤕 골절 의심</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>골절 부위가 움직이지 않게 <strong>부목·딱딱한 책</strong>으로 고정</li>
          <li>고정이 어렵거나 확신 없으면 건드리지 말고 담요 감싸서 이송</li>
          <li>수술 가능성 있으니 <strong>무엇을 먹이지도 말기</strong> (마취 문제)</li>
        </ul>

        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">🌀 경련·발작</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>손으로 누르지 말기 — 척추 부상 위험</li>
          <li>주변의 딱딱한 물건 치우고 부상 방지</li>
          <li>경련이 멎을 때까지 기다린 후 즉시 이송</li>
          <li>구토물·먹던 음식 있으면 <strong>샘플 확보</strong> (중독 진단용)</li>
        </ul>

        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">🤮 중독 의심</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>입에 거품 + 구토 + 기력 소실이면 즉시 이송</li>
          <li>주변에 의심 물질(쥐약·부동액·청소약품) 있으면 <strong>용기·라벨 촬영</strong></li>
          <li>사람용 최토제·활성탄 금지 — 반드시 수의사 판단으로</li>
        </ul>

        <h3 className="text-[14px] font-bold text-text-main mt-4 mb-2">❄️ 저체온</h3>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>수건으로 감싸고 자동차 히터로 실내 20~25℃ 유지</li>
          <li>핫팩은 수건에 <strong>감싼 후</strong> 간접적으로 (직접 닿으면 저온 화상)</li>
          <li>뜨거운 물에 담그거나 드라이어 금지 — 쇼크 위험</li>
        </ul>
      </section>

      {/* Step 4 */}
      <section id="step-4" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Car size={20} color="#6B8E6F" />
          <span className="w-7 h-7 rounded-full bg-[#6B8E6F] text-white text-[12px] font-extrabold flex items-center justify-center">4</span>
          안전 이송
        </h2>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li>이동장·박스에 <strong>담요 깔고</strong> 고양이를 수건으로 감싸 넣기</li>
          <li>이동장 없으면 큰 박스 + 뚜껑 (숨구멍 필수)</li>
          <li>차량 내 온도 20~25℃ 유지. 에어컨 직풍 금지</li>
          <li>흔들림 최소화 — 조수석 바닥이 가장 안정</li>
          <li>운전자 외 1명은 <strong>병원에 전화 예고</strong>: "10분 뒤 도착, 로드킬 의심 성묘, 출혈 있음"</li>
          <li>가까운 24시간 동물병원 모르면 <Link href="/hospitals" className="text-primary font-bold underline">구조동물 치료 병원</Link> 목록에서 확인</li>
        </ul>
      </section>

      {/* Step 5 */}
      <section id="step-5" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Flame size={20} color="#E88D5A" />
          <span className="w-7 h-7 rounded-full bg-[#E88D5A] text-white text-[12px] font-extrabold flex items-center justify-center">5</span>
          사후 조치·신고
        </h2>
        <ul className="text-[13.5px] text-text-main space-y-2 pl-4 list-disc leading-relaxed">
          <li><strong>학대 정황</strong>이 있으면 112 신고 + 증거 사진 확보 (동물보호법 제8조 위반 = 형사처벌 대상)</li>
          <li><strong>로드킬</strong>은 도로관리청(1577-2504)에 장소·시간 신고 → 재발 방지·운전자 주의 표지판</li>
          <li>병원 치료 후 발견 장소에 재방사할지, 임시보호할지 결정 — <Link href="/community/category/foster" className="text-primary font-bold underline">커뮤니티 임보</Link>에 도움 요청 가능</li>
          <li>도시공존 지도의 <Link href="/map" className="text-primary font-bold underline">학대 경보</Link>를 남겨 이웃들도 주의하게</li>
          <li>구청 동물보호 부서 연락처: <Link href="/protection/district-contacts" className="text-primary font-bold underline">시·구·군청 담당부서</Link></li>
        </ul>
      </section>

      {/* 하지 말아야 할 것 */}
      <section id="dont" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <AlertTriangle size={20} color="#D85555" />
          절대 하지 말아야 할 행동
        </h2>
        <div className="rounded-2xl p-4" style={{ background: "#FDECEC", border: "1px solid rgba(216,85,85,0.2)" }}>
          <ul className="text-[13.5px] space-y-2 pl-4 list-disc leading-relaxed" style={{ color: "#8B2F2F" }}>
            <li><strong>사람용 약 투여</strong> — 타이레놀·아스피린·이부프로펜 등. 치명적</li>
            <li><strong>억지로 물·음식 주기</strong> — 의식 저하 상태면 기도 막힘</li>
            <li><strong>상처를 알코올·과산화수소로 닦기</strong> — 조직 손상 악화</li>
            <li><strong>뜨거운 물·드라이어로 몸 녹이기</strong> — 쇼크·화상</li>
            <li><strong>맨손 포획</strong> — 물리면 Pasteurella 감염 위험</li>
            <li><strong>혼자 포획 무리하기</strong> — 고양이가 2차 부상 입기 쉬움. 도움 요청</li>
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
            href="/protection/kitten-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">🐱</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">새끼 고양이(냥줍) 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">어린 아이 발견했을 때 대응</p>
            </div>
          </Link>
          <Link
            href="/protection/trapping-guide"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">✂️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">TNR 포획 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">중성화 수술을 위한 안전한 포획</p>
            </div>
          </Link>
          <Link
            href="/protection/legal"
            className="flex items-center gap-3 p-4 rounded-xl bg-white active:scale-[0.99]"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[18px]">⚖️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold text-text-main">동물보호법·학대 신고</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">법적 대응과 증거 확보 방법</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 신뢰 출처 */}
      <section className="mb-8 rounded-2xl p-4" style={{ background: "#F6F1EA", border: "1px solid rgba(0,0,0,0.04)" }}>
        <h3 className="text-[13px] font-bold text-text-main mb-2">참고한 공공 자료</h3>
        <ul className="text-[12px] text-text-sub space-y-1 pl-4 list-disc leading-relaxed">
          <li>동물보호관리시스템 (animal.go.kr) — 농림축산식품부</li>
          <li>동물보호법 및 시행령</li>
          <li>국민재난안전포털 (safekorea.go.kr)</li>
        </ul>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          이 가이드는 공개된 일반 정보를 정리한 참고 자료이며 <strong>수의사의 진단·처방을 대체하지 않습니다</strong>.
          생명이 위급할 땐 반드시 가장 가까운 24시간 동물병원에 즉시 연락·이송하세요.
        </p>
      </section>
    </div>
  );
}
