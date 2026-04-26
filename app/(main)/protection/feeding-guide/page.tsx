import type { Metadata } from "next";
import Link from "next/link";
import GuideReadMarker from "@/app/components/GuideReadMarker";
import {
  ArrowLeft, Utensils, AlertTriangle, Clock, MapPin, Droplet,
  HelpCircle, BookOpen, Ban, Cat, Scale,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 먹이 가이드 — 주면 안 되는 음식부터 안전한 급식까지",
  description:
    "길고양이에게 무엇을 줘야 할지, 어떻게 줘야 할지 한눈에. 우유·참치캔·사람 음식 금지 이유, 안전한 건사료·습식 선택법, 급식소 설치 원칙, 여름·겨울 주의사항까지 정리.",
  keywords: [
    "길고양이 먹이", "고양이 우유", "고양이 참치캔",
    "길고양이 밥", "길냥이 사료", "길고양이 급식",
    "고양이에게 주면 안 되는 음식", "캣푸드 추천",
    "길고양이 급식소", "길고양이 물", "길고양이 영양", "도시공존",
  ],
  alternates: { canonical: "/protection/feeding-guide" },
  openGraph: {
    title: "길고양이 먹이 가이드 — 안전한 급식 완벽 정리 | 도시공존",
    description: "우유·참치캔 금지 이유부터 급식소 운영까지. 길고양이 건강 지키는 먹이 가이드.",
    url: `${SITE_URL}/protection/feeding-guide`,
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "길고양이 먹이 가이드 — 주면 안 되는 음식부터 안전한 급식까지",
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
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/protection/feeding-guide` },
  description: "길고양이에게 안전하게 먹이를 주는 방법 — 금지 음식·사료 선택·급식소 원칙",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "길고양이에게 우유를 주면 왜 안 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "고양이 대부분은 유당불내증이에요. 시판 우유의 유당을 분해하지 못해 설사와 탈수를 유발하고, 특히 길고양이처럼 체력이 약한 개체에겐 치명적일 수 있어요. 물이 최선이고, 꼭 우유 느낌이 필요하다면 반려동물 전용 락토프리 우유를 소량만.",
      },
    },
    {
      "@type": "Question",
      name: "참치캔을 주식으로 줘도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "안 됩니다. 사람용 참치캔은 염분·인이 고양이 기준으로 매우 높아서 신장·심장에 부담을 줘요. 수은 축적도 걱정입니다. 주식은 고양이 전용 건사료 또는 습식(펫푸드)로, 참치캔은 아주 가끔 간식으로만.",
      },
    },
    {
      "@type": "Question",
      name: "한번 밥을 주기 시작하면 끝까지 줘야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네, 책임감이 중요해요. 길고양이는 급식 패턴에 몸을 맞추기 때문에 갑자기 끊으면 다른 먹이를 찾지 못해 아사 위험이 있어요. 이사·여행 등으로 어려우면 동네 캣맘·캣대디에게 인수인계를 부탁하거나 도시공존 커뮤니티에서 이웃 구하세요.",
      },
    },
    {
      "@type": "Question",
      name: "급식소 위치는 어디가 좋나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "CCTV·차량 통행이 적고 건물 그늘이 있는 곳, 행인 동선에서 살짝 벗어난 곳이 이상적이에요. 건물 관리자·이웃과 협의 필수. 민원이 빈번한 공공 장소는 피하고, 위치를 SNS에 공개하지 마세요(악용 위험).",
      },
    },
    {
      "@type": "Question",
      name: "겨울에 물이 얼어요. 어떻게 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "얕은 스테인리스 그릇보다 두꺼운 플라스틱·스티로폼이 어는 속도가 느려요. 하루 1~2회 미지근한 물로 교체하고, 가능하다면 반려동물용 온열 급수기(야외용) 설치. 눈 쌓인 지역은 눈도 수분 공급원이 되지만 저체온증 위험이 있어 사료에 미지근한 물을 살짝 섞어주는 것도 방법.",
      },
    },
  ],
};

const BAD_FOODS: { emoji: string; name: string; reason: string }[] = [
  { emoji: "🥛", name: "우유 · 유제품", reason: "유당불내증 → 설사·탈수. 길고양이에겐 특히 치명적." },
  { emoji: "🍣", name: "사람용 참치캔", reason: "염분·인 과다, 수은 축적. 신장·심장 부담." },
  { emoji: "🧄", name: "마늘 · 양파 · 부추", reason: "적혈구 파괴 → 빈혈·장기 손상. 소량도 위험." },
  { emoji: "🍫", name: "초콜릿 · 커피 · 차", reason: "테오브로민·카페인 → 신경·심장 독성." },
  { emoji: "🍇", name: "포도 · 건포도", reason: "급성 신부전 유발. 원인 물질 미규명." },
  { emoji: "🦴", name: "익힌 닭·생선 뼈", reason: "날카롭게 쪼개져 식도·내장 손상." },
  { emoji: "🍞", name: "빵 · 반죽", reason: "이스트가 위장에서 팽창 → 가스·알코올 중독." },
  { emoji: "🥜", name: "마카다미아 견과", reason: "신경독성 · 마비." },
  { emoji: "🧂", name: "소금 간 한 사람 음식", reason: "나트륨 과다 → 탈수·신장 손상." },
  { emoji: "🍬", name: "자일리톨 함유 간식", reason: "저혈당·간부전. 반려동물 전체 공통 금지." },
];

const GOOD_FOODS: { emoji: string; name: string; tip: string }[] = [
  { emoji: "🥣", name: "고양이 전용 건사료", tip: "주식. 길고양이용 저자극 제품이 이상적. 개봉 후 3개월 이내 소진." },
  { emoji: "🥫", name: "고양이 전용 습식(파우치·캔)", tip: "수분 공급에 좋음. 여름·노묘·탈수 의심 시 효과적." },
  { emoji: "🐟", name: "무염 삶은 생선", tip: "가시 완벽 제거 필수. 간식 수준으로만." },
  { emoji: "🍗", name: "무염 삶은 닭가슴살", tip: "기름기 적고 단백질 풍부. 간식 대체에 최적." },
  { emoji: "💧", name: "깨끗한 물", tip: "항상 동반 필수. 하루 1회 이상 교체." },
  { emoji: "🌿", name: "캣그라스", tip: "헤어볼 배출 도움. 화분째 놓아두면 스스로 뜯어 먹음." },
];

const STEPS = [
  {
    icon: Clock,
    title: "1. 시간 · 장소 고정",
    desc: "같은 시간, 같은 장소가 원칙. 길고양이는 패턴에 몸을 맞추기 때문에 규칙성이 스트레스·영역 분쟁을 줄입니다. 저녁 시간대(17~19시)가 가장 안정적.",
  },
  {
    icon: Utensils,
    title: "2. 양은 '20분 내 먹을 만큼'",
    desc: "남은 사료는 쥐·벌레·까마귀를 불러와 민원 원인이 됩니다. 20분 정도 지켜보다 남으면 회수. 처음엔 반 공기부터 시작해 적정량을 찾아가세요.",
  },
  {
    icon: MapPin,
    title: "3. 위치 선정 원칙",
    desc: "CCTV·차도에서 떨어지고 건물 그늘 있는 곳. 건물 관리인·1층 거주자와 사전 협의 필수. 공공장소·아파트 단지 내는 민원 발생 가능성이 높아 허락 없이 운영 금지.",
  },
  {
    icon: Droplet,
    title: "4. 물은 사료보다 중요",
    desc: "길고양이 만성질환 1위는 탈수·신장질환이에요. 사료는 하루 거를 수 있어도 물은 절대 금지. 겨울엔 미지근한 물로 하루 2회 교체.",
  },
  {
    icon: Scale,
    title: "5. 청결 · 민원 대응",
    desc: "먹은 자리는 매번 깨끗이. 빈 캔·파우치는 반드시 수거. 민원이 들어오면 도망가지 말고 정중하게 설명하고 위치를 조정하세요. 쫓겨나면 그곳 아이들이 굶어요.",
  },
];

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "도시공존", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "보호지침", item: `${SITE_URL}/protection` },
    { "@type": "ListItem", position: 3, name: "먹이 가이드", item: `${SITE_URL}/protection/feeding-guide` },
  ],
};

export default function FeedingGuidePage() {
  return (
    <div className="px-5 pt-12 pb-16 max-w-3xl mx-auto">
      <GuideReadMarker slug="feeding-guide" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* 헤더 */}
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
        길고양이 먹이 가이드 — <br />
        <span style={{ color: "#E88D5A" }}>안전한 급식</span>의 기본
      </h1>

      {/* 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #FFF4E8 0%, #FFE8D1 100%)",
          border: "1px solid rgba(232,141,90,0.18)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          길고양이에게 <strong>우유 · 참치캔 · 사람 음식</strong>을 주는 건 선의지만 실제로는 건강을 해칩니다.
          올바른 급식은 <strong>고양이 전용 사료 + 깨끗한 물</strong>을 규칙적으로 제공하는 것이 전부.
          이 글은 금지 음식, 안전 음식, 급식소 운영 5원칙, 계절별 주의사항을 정리한 실전 매뉴얼입니다.
        </p>
        <p className="text-[11px] text-text-sub mt-3">마지막 업데이트: {LAST_UPDATED}</p>
      </div>

      {/* 목차 */}
      <nav aria-label="목차" className="rounded-2xl bg-white p-4 mb-6" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
        <p className="text-[11px] font-extrabold text-text-sub tracking-[0.1em] mb-2">목차</p>
        <ol className="text-[13px] space-y-1 text-text-main list-decimal pl-5">
          <li><a href="#bad" className="hover:underline">절대 주면 안 되는 음식 10가지</a></li>
          <li><a href="#good" className="hover:underline">안전하고 권장되는 음식</a></li>
          <li><a href="#rules" className="hover:underline">급식 5원칙 — 시간·양·장소·물·청결</a></li>
          <li><a href="#seasons" className="hover:underline">계절별 주의사항</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 금지 음식 */}
      <section id="bad" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Ban size={20} color="#D85555" />
          절대 주면 안 되는 음식 10가지
        </h2>
        <p className="text-[14px] text-text-main leading-relaxed mb-3">
          아래 음식은 <strong>소량으로도 응급 상황</strong>을 만들 수 있어요. "조금은 괜찮겠지" 하지 마세요.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {BAD_FOODS.map((f) => (
            <div
              key={f.name}
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: "#FBEAEA", border: "1px solid rgba(216,85,85,0.15)" }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} className="shrink-0">{f.emoji}</span>
              <div>
                <p className="text-[13px] font-extrabold" style={{ color: "#8B2F2F" }}>{f.name}</p>
                <p className="text-[12px] text-text-sub mt-0.5 leading-snug">{f.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 안전 음식 */}
      <section id="good" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Utensils size={20} color="#6B8E6F" />
          안전하고 권장되는 음식
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {GOOD_FOODS.map((f) => (
            <div
              key={f.name}
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: "#E8F5E9", border: "1px solid rgba(107,142,111,0.18)" }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} className="shrink-0">{f.emoji}</span>
              <div>
                <p className="text-[13px] font-extrabold" style={{ color: "#2E5A34" }}>{f.name}</p>
                <p className="text-[12px] text-text-sub mt-0.5 leading-snug">{f.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 급식 5원칙 */}
      <section id="rules" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <BookOpen size={20} color="#C47E5A" />
          급식 5원칙
        </h2>
        <div className="space-y-2">
          {STEPS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl bg-white p-4 flex items-start gap-3"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(196,126,90,0.12)" }}
              >
                <Icon size={18} style={{ color: "#C47E5A" }} />
              </div>
              <div>
                <p className="text-[14px] font-extrabold text-text-main">{title}</p>
                <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 계절별 */}
      <section id="seasons" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <AlertTriangle size={20} color="#E88D5A" />
          계절별 주의사항
        </h2>
        <div className="space-y-2.5">
          <div className="rounded-2xl p-4" style={{ background: "#FFF3E0", border: "1px solid #F2D4A5" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#B56A1A" }}>🌞 여름 (6~8월)</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>건사료는 2시간 내 변질 — 소량 자주 교체</li>
              <li>습식은 직사광선 피해 그늘에, 1시간 내 회수</li>
              <li>물그릇은 하루 2회 이상 교체, 얕은 것보다 깊은 그릇이 시원함 유지</li>
              <li>폭염 시 젖은 수건을 쉼터 그늘에 깔아주면 체온 조절에 도움</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#E3F2FD", border: "1px solid #B3D9E8" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#1E5B8C" }}>❄️ 겨울 (12~2월)</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>물이 얼면 전부 동사 위험 — 미지근한 물 하루 1~2회 교체</li>
              <li>사료에 미지근한 물 살짝 섞어 주면 수분 섭취에 도움</li>
              <li>급식 시간 뒤 남은 사료는 꼭 회수 (얼어붙음)</li>
              <li>스티로폼 숨숨집 내부에 핫팩 넣어두면 체온 유지에 결정적</li>
            </ul>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#F1F8E9", border: "1px solid #C8E2B0" }}>
            <p className="text-[13.5px] font-extrabold" style={{ color: "#3F6B1F" }}>🌸 봄·가을 (환절기)</p>
            <ul className="text-[12.5px] text-text-sub mt-1.5 leading-relaxed space-y-1 list-disc pl-5">
              <li>환절기엔 면역력 저하로 결막염·호흡기 질환 발생 증가</li>
              <li>노묘는 관절염 악화 — 사료에 관절 영양제 살짝 섞어주는 것도 방법</li>
              <li>발정기·영역 싸움 상처 관찰 → 도시공존 '건강 체크' 기록에 남기면 이웃과 공유 가능</li>
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
          <Link
            href="/protection/trapping-guide"
            className="bg-white rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98]"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <span style={{ fontSize: 22 }}>✂️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-extrabold text-text-main">TNR 포획 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">중성화 수술 전 과정</p>
            </div>
          </Link>
          <Link
            href="/protection/kitten-guide"
            className="bg-white rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98]"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <span style={{ fontSize: 22 }}>🐾</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-extrabold text-text-main">냥줍 가이드 (새끼 고양이)</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">관찰·체온·급여 3단계</p>
            </div>
          </Link>
        </div>
      </section>

      {/* CTA */}
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
