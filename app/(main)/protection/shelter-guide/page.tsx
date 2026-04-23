import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Thermometer, Wrench, AlertTriangle,
  HelpCircle, Hammer, Cat,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 겨울나기 · 숨숨집 만들기 완벽 가이드",
  description:
    "길고양이 쉼터(숨숨집) DIY 완벽 가이드. 스티로폼 박스 선택, 단열재·방수 시공, 입구 방향, 핫팩 사용 여부, 설치 위치 원칙. 겨울 동사 예방부터 여름 그늘 쉼터까지.",
  keywords: [
    "길고양이 겨울", "길고양이 쉼터", "숨숨집 만들기",
    "스티로폼 고양이 집", "길고양이 집 DIY", "길고양이 보금자리",
    "길고양이 동사", "고양이 방한",
    "길고양이 여름 그늘", "길고양이 쉼터 위치", "도시공존",
  ],
  alternates: { canonical: "/protection/shelter-guide" },
  openGraph: {
    title: "길고양이 겨울나기 · 숨숨집 만들기 | 도시공존",
    description: "스티로폼 박스로 만드는 길고양이 쉼터. 방한·방수·입구 방향 원칙까지.",
    url: `${SITE_URL}/protection/shelter-guide`,
  },
};

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "도시공존", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "보호지침", item: `${SITE_URL}/protection` },
    { "@type": "ListItem", position: 3, name: "쉼터·겨울나기 가이드", item: `${SITE_URL}/protection/shelter-guide` },
  ],
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "길고양이 겨울나기 · 숨숨집 만들기 완벽 가이드",
  image: `${SITE_URL}/icons/icon-512.png`,
  datePublished: "2026-04-19",
  dateModified: LAST_UPDATED,
  inLanguage: "ko-KR",
  author: { "@type": "Organization", name: "도시공존" },
  publisher: {
    "@type": "Organization",
    name: "도시공존",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/protection/shelter-guide` },
  description: "길고양이 쉼터 DIY — 재료·제작법·설치·계절 운영 완벽 매뉴얼",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "스티로폼 박스로 길고양이 숨숨집 만드는 법",
  description: "겨울 동사를 막는 단열·방수 쉼터를 집에서 만드는 방법",
  image: `${SITE_URL}/icons/icon-512.png`,
  totalTime: "PT30M",
  estimatedCost: { "@type": "MonetaryAmount", currency: "KRW", value: "15000" },
  supply: [
    { "@type": "HowToSupply", name: "두께 3~5cm 스티로폼 박스 (40×30×30cm 전후)" },
    { "@type": "HowToSupply", name: "은박 돗자리 또는 단열 시트" },
    { "@type": "HowToSupply", name: "방수 테이프 · 박스 테이프" },
    { "@type": "HowToSupply", name: "짚 · 털담요 · 폴리스 솜 (이불감)" },
    { "@type": "HowToSupply", name: "커터칼 · 자" },
  ],
  step: [
    { "@type": "HowToStep", name: "재료 선택", text: "스티로폼 박스는 두께 3cm 이상, 신선식품 배송용이 튼튼합니다." },
    { "@type": "HowToStep", name: "입구 재단", text: "가로 15cm × 세로 17cm 정도 구멍을 박스 측면 상단에 냅니다. 바닥에 내면 비·눈이 들어와요." },
    { "@type": "HowToStep", name: "내부 단열", text: "내벽·바닥에 은박 돗자리를 붙여 체온 반사. 바닥엔 짚을 깔아요. 헝겊 담요는 젖으면 오히려 체온 뺏어요." },
    { "@type": "HowToStep", name: "방수 처리", text: "뚜껑 틈새에 방수 테이프. 박스 외부 전체를 비닐로 한 번 더 감싸면 수명 3배." },
    { "@type": "HowToStep", name: "설치", text: "입구가 바람 반대 방향을 향하게. 바닥에 팔레트나 벽돌 놓아 지면에서 띄우기. 고양이 키 정도 높이에 올리면 안전성 +." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "스티로폼 말고 다른 재료는 안 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "플라스틱 상자도 가능하지만 단열력이 약해서 반드시 내부에 은박 돗자리·폴리스 솜을 덧대야 해요. 종이 박스는 2~3주면 습기로 무너집니다. 가장 비용 대비 효과 좋은 건 두꺼운 스티로폼 박스(3cm 이상).",
      },
    },
    {
      "@type": "Question",
      name: "담요를 깔아주면 좋지 않나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "마른 담요는 OK지만 젖으면 오히려 체온을 뺏어요. 가장 안전한 건 짚이에요. 짚은 습기를 흡수하면서도 체온을 유지해주고, 벌레도 덜 꼬여요. 1~2주에 한 번 교체해주세요.",
      },
    },
    {
      "@type": "Question",
      name: "핫팩을 넣어도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "일반 핫팩은 위험해요. 터지면 화학물질 노출, 뜨거워서 화상 가능. 굳이 넣는다면 반려동물용 전용 히팅패드(저온 유지형)만 사용하고, 매일 상태 확인해야 합니다. 핫팩보다는 은박 돗자리+짚 조합이 훨씬 안전하고 효과적.",
      },
    },
    {
      "@type": "Question",
      name: "숨숨집을 어디 설치해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "건물 처마 밑, 차량 통행이 없는 그늘 공간, 지면에서 15~30cm 떠 있는 곳이 이상적이에요. 민원을 피하려면 건물 관리인·1층 거주자와 사전 협의. 공공장소에 무단 설치 시 강제 철거 위험이 있으니 꼭 허락받고 설치하세요.",
      },
    },
    {
      "@type": "Question",
      name: "여름에도 쉼터가 필요한가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네. 여름엔 '그늘 · 바람 · 물'이 핵심. 겨울용 스티로폼 집은 더우니 입구를 크게 개방하거나 계절 교체. 건물 북쪽·나무 그늘·지하 주차장 입구 등 시원한 곳에 얕은 물그릇과 평평한 나무판만 놓아도 훌륭한 쉼터가 됩니다.",
      },
    },
  ],
};

const MATERIALS = [
  { emoji: "📦", name: "스티로폼 박스 (두께 3cm+)", note: "40×30×30cm 전후. 신선식품 배송용 재활용 가능." },
  { emoji: "🛌", name: "짚 (권장) 또는 폴리스 솜", note: "헝겊 담요 X — 젖으면 체온 뺏김." },
  { emoji: "🪞", name: "은박 돗자리 · 단열 시트", note: "내벽·바닥에 붙여 체온 반사 효과." },
  { emoji: "🎀", name: "방수 테이프 · 박스 테이프", note: "뚜껑 틈새 + 외부 비닐 감싸기." },
  { emoji: "🪚", name: "커터칼 · 자", note: "입구 구멍 재단용." },
  { emoji: "🧱", name: "벽돌 · 팔레트 (선택)", note: "지면에서 띄워 습기·냉기 차단." },
];

const CAUTIONS = [
  {
    title: "입구는 반드시 측면 상단",
    desc: "바닥에 뚫으면 비·눈·바람이 그대로 들어와 오히려 위험. 측면, 그것도 위쪽에 내야 바닥이 건조해요.",
  },
  {
    title: "입구 크기는 고양이 머리보다 약간 큼",
    desc: "15×17cm 정도. 너무 크면 차가운 바람이 들어오고, 너무 작으면 새끼가 못 들어가요.",
  },
  {
    title: "2개 이상 설치",
    desc: "한 곳에만 두면 텃세 싸움으로 약한 아이가 못 들어가요. 가능하면 5~10m 간격으로 2개.",
  },
  {
    title: "설치 후 2~3일 관찰",
    desc: "사람 냄새가 익숙해지는 데 시간이 걸려요. 처음 며칠은 입구 밖에 간식 한 조각 놓아 유도.",
  },
  {
    title: "건물 관리자 사전 허락",
    desc: "아파트 단지·상가 공동구역에 허락 없이 설치하면 철거됩니다. 미리 설명하고 협조 구하는 게 장기적으로 유리.",
  },
];

export default function ShelterGuidePage() {
  return (
    <div className="px-5 pt-12 pb-16 max-w-3xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/protection"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="보호지침으로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">
          <Link href="/protection" className="hover:underline">보호지침</Link>
        </span>
      </div>

      <h1 className="text-[26px] font-black text-text-main leading-tight tracking-tight mb-3">
        길고양이 <span style={{ color: "#4A7BA8" }}>겨울나기</span> · <br />숨숨집 만들기
      </h1>

      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)",
          border: "1px solid rgba(74,123,168,0.18)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          한겨울 길고양이 사망 원인 1위는 <strong>동사와 탈수</strong>예요.
          두꺼운 스티로폼 박스 하나, 재료비 <strong>1만 5천 원 내외</strong>로 동네 아이들을 지킬 수 있습니다.
          이 가이드는 재료 선택부터 제작 · 설치 · 운영 · 계절별 조정까지 실전 매뉴얼입니다.
        </p>
        <p className="text-[11px] text-text-sub mt-3">마지막 업데이트: {LAST_UPDATED}</p>
      </div>

      <nav aria-label="목차" className="rounded-2xl bg-white p-4 mb-6" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
        <p className="text-[11px] font-extrabold text-text-sub tracking-[0.1em] mb-2">목차</p>
        <ol className="text-[13px] space-y-1 text-text-main list-decimal pl-5">
          <li><a href="#materials" className="hover:underline">준비물</a></li>
          <li><a href="#how" className="hover:underline">5단계 제작법</a></li>
          <li><a href="#cautions" className="hover:underline">꼭 지켜야 할 5가지</a></li>
          <li><a href="#seasons" className="hover:underline">계절별 운영</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 준비물 */}
      <section id="materials" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Wrench size={20} color="#4A7BA8" />
          준비물 (총 약 1만 5천 원)
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {MATERIALS.map((m) => (
            <div
              key={m.name}
              className="rounded-xl p-3 flex items-start gap-3 bg-white"
              style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }} className="shrink-0">{m.emoji}</span>
              <div>
                <p className="text-[13px] font-extrabold text-text-main">{m.name}</p>
                <p className="text-[12px] text-text-sub mt-0.5 leading-snug">{m.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 제작법 */}
      <section id="how" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Hammer size={20} color="#C47E5A" />
          5단계 제작법
        </h2>
        <div className="space-y-2">
          {howToSchema.step.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-4 flex items-start gap-3"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[13px] font-extrabold"
                style={{ background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" }}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-[14px] font-extrabold text-text-main">{s.name}</p>
                <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 주의사항 */}
      <section id="cautions" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <AlertTriangle size={20} color="#D85555" />
          꼭 지켜야 할 5가지
        </h2>
        <div className="space-y-2">
          {CAUTIONS.map((c) => (
            <div
              key={c.title}
              className="rounded-xl p-3.5"
              style={{ background: "#FBEAEA", border: "1px solid rgba(216,85,85,0.15)" }}
            >
              <p className="text-[13px] font-extrabold" style={{ color: "#8B2F2F" }}>⚠️ {c.title}</p>
              <p className="text-[12px] text-text-sub mt-1 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 계절별 */}
      <section id="seasons" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Thermometer size={20} color="#E88D5A" />
          계절별 운영
        </h2>
        <div className="space-y-2.5">
          <div className="rounded-2xl p-4" style={{ background: "#E3F2FD", border: "1px solid #B3D9E8" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#1E5B8C" }}>❄️ 겨울 (11월 중순 ~ 2월)</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>짚은 2주마다 교체 (습기·벌레)</li>
              <li>입구에 천을 커튼처럼 늘어뜨리면 바람 막이 추가</li>
              <li>폭설 후엔 입구가 막히지 않았는지 확인</li>
              <li>물그릇은 쉼터 밖, 사료는 쉼터 근처 다른 지점</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#FFF3E0", border: "1px solid #F2D4A5" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#B56A1A" }}>🌞 여름 (6 ~ 9월)</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>겨울용 스티로폼 박스는 덥고 곰팡이 위험 — 교체 또는 입구 확장</li>
              <li>그늘 있는 평평한 나무판·돌만 있어도 쉼터 역할</li>
              <li>물그릇은 깊고 넓게, 하루 2회 이상 교체</li>
              <li>벌레·기생충 방제를 고려해 주변 청결 유지</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#F1F8E9", border: "1px solid #C8E2B0" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#3F6B1F" }}>🌸 봄·가을 환절기</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>봄: 기생충 관리 시작 (구충제 처방 등)</li>
              <li>가을: 겨울 대비 짚·단열 시트 미리 교체</li>
              <li>장마철: 방수 테이프 점검, 입구 방향 확인</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <HelpCircle size={20} color="#8B65B8" />
          자주 묻는 질문
        </h2>
        <div className="space-y-2">
          {faqSchema.mainEntity.map((q, i) => (
            <details key={i} className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <summary className="text-[13.5px] font-extrabold text-text-main cursor-pointer list-none flex items-center justify-between">
                <span>Q. {q.name}</span>
                <span className="text-text-light text-[12px]">+</span>
              </summary>
              <p className="text-[12.5px] text-text-sub mt-2.5 leading-relaxed whitespace-pre-line">
                {q.acceptedAnswer.text}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 관련 가이드 */}
      <section className="mb-8">
        <h2 className="text-[15px] font-extrabold text-text-main mb-3">함께 보면 좋은 가이드</h2>
        <div className="grid grid-cols-1 gap-2">
          <Link
            href="/protection/feeding-guide"
            className="bg-white rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98]"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <span style={{ fontSize: 22 }}>🍚</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-extrabold text-text-main">먹이 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">안전한 급식 · 계절별 주의사항</p>
            </div>
          </Link>
          <Link
            href="/protection/emergency-guide"
            className="bg-white rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98]"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <span style={{ fontSize: 22 }}>🚨</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-extrabold text-text-main">응급 구조 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">다친 아이 발견 시 대응법</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mb-2">
        <Link
          href="/map"
          className="block text-center py-4 rounded-2xl bg-primary text-white text-[14px] font-extrabold active:scale-[0.98]"
          style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
        >
          <Cat size={16} className="inline mr-1.5 -mt-0.5" />
          우리 동네 지도에서 돌봄 시작하기
        </Link>
      </section>
    </div>
  );
}
