import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, HelpCircle, BookOpen, Pill, Shield, Stethoscope,
  Droplets, Bug, Eye, Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BackButton from "./BackButton";

const LAST_UPDATED = "2026-04-19";

export const metadata: Metadata = {
  title: "길고양이 약품·영양제 가이드 — 구충제·영양제·응급약",
  description:
    "길고양이 돌봄에 쓰이는 동물약국 약품·영양제 총정리. 구충제(레볼루션·브라벡토), 영양제(락토, 오메가3), 안약, 응급 연고까지. 사람약 금지 리스트 포함.",
  keywords: [
    "길고양이 약품", "고양이 구충제", "길고양이 영양제", "고양이 안약",
    "고양이 레볼루션", "고양이 브라벡토", "고양이 락토", "고양이 오메가3",
    "사람약 고양이 금지", "동물약국", "고양이 응급약",
  ],
  alternates: { canonical: "/protection/pharmacy-guide" },
  openGraph: {
    title: "길고양이 약품·영양제 가이드 | 도시공존",
    description: "구충제부터 영양제·응급약까지. 캣맘이 알아야 할 동물약국 필수 정보.",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "길고양이에게 사람 약을 주면 안 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "절대 금지입니다. 특히 아세트아미노펜(타이레놀)은 소량만으로도 간 괴사를 일으켜 치명적이고, 이부프로펜·아스피린도 신장 독성이 있습니다. 사람용 소염제·진통제·감기약·종합비타민 어떤 것도 고양이에게 주지 마세요. 반드시 수의사 처방 또는 고양이 전용 약품을 사용해야 합니다.",
      },
    },
    {
      "@type": "Question",
      name: "동물약국과 동물병원은 뭐가 다른가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "동물약국은 약사 면허자가 운영하며 처방전 없이 구매 가능한 일반의약품·영양제·사료·위생용품을 판매합니다. 처방전이 필요한 전문의약품(마취제·항생제·스테로이드 등)은 동물병원·수의사 처방을 통해서만 구할 수 있어요. 간단한 구충제·영양제는 동물약국이 저렴하고 빠릅니다.",
      },
    },
    {
      "@type": "Question",
      name: "길고양이 구충제는 얼마마다 주나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "외부 구충(벼룩·진드기)은 월 1회가 권장 주기이고, 내부 구충(회충·촌충)은 3개월 간격이 일반적입니다. 레볼루션·애드보킷 같은 종합형 제품은 1개 월간 내·외부 동시 예방 가능해요. 길고양이 상태에 따라 수의사와 상담해 주기를 조정하세요.",
      },
    },
    {
      "@type": "Question",
      name: "레볼루션·브라벡토 중 뭐가 좋나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "레볼루션(Revolution/Selamectin)은 1개월 지속되는 목뒤 바르는 타입으로 벼룩·진드기·귀진드기·회충까지 커버. 브라벡토(Bravecto/Fluralaner)는 3개월 지속, 씹거나 목뒤 타입 둘 다 있어요. 길고양이는 정기 투약이 어려워 브라벡토의 긴 지속 시간이 유리. 단 가격은 레볼루션보다 높습니다.",
      },
    },
    {
      "@type": "Question",
      name: "영양제(락토·오메가3)는 꼭 필요한가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "필수는 아니지만 상황별로 유효합니다. 락토는 설사·장 트러블 시 유산균 보충, 오메가3는 노묘·피부 알레르기·관절 염증에 도움. 건강한 성묘에게 일상적으로는 과용 금물이고, 증상 있거나 노묘에게 보조적으로 주세요. 사료에서 얻는 영양이 우선입니다.",
      },
    },
    {
      "@type": "Question",
      name: "고양이 눈곱이 심해요. 안약 사서 넣으면 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "일반 인공눈물(히알루론산)은 안전하지만, 사람용 소염 안약(특히 스테로이드 포함)은 금지. 고양이는 스테로이드에 예민해 각막 손상·녹내장 위험이 있습니다. 증상 심하거나 3일 이상 지속되면 허피스 바이러스 감염 등 다른 원인 가능성 있으니 병원 상담.",
      },
    },
    {
      "@type": "Question",
      name: "상처에 소독약을 써도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "과산화수소(옥시풀)·알코올·빨간약(포비돈) 모두 고양이에게는 독성 또는 자극이 있어 권장하지 않습니다. 가장 안전한 건 생리식염수로 씻기. 얕은 상처는 생리식염수 세척 후 건조, 깊거나 출혈이 계속되면 병원 행. 상처 핥기 방지용 목 카라가 있으면 유용합니다.",
      },
    },
    {
      "@type": "Question",
      name: "비타민 종합제를 줘도 되나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "사람용 종합비타민은 비타민 D·철분 과잉으로 위험. 고양이는 사료에서 필요 영양 대부분을 얻으니 별도 종합비타민은 불필요. 특정 결핍(예: 만성 질환 고양이)이 있으면 수의사 처방으로 고양이 전용 영양제 사용하세요.",
      },
    },
  ],
};

const BANNED_DRUGS = [
  { name: "아세트아미노펜(타이레놀)", reason: "간 괴사 — 소량으로도 치명적" },
  { name: "이부프로펜·아스피린", reason: "신장·위장 독성, 출혈 위험" },
  { name: "감기약·항히스타민", reason: "신경 독성, 저혈압 쇼크" },
  { name: "종합비타민 (사람용)", reason: "비타민 D·철분 과잉" },
  { name: "과산화수소·알코올", reason: "조직 손상, 구토 유발" },
  { name: "Tea tree oil 등 에센셜 오일", reason: "간 독성 — 피부·공기 흡입 모두 위험" },
  { name: "항우울제·불안제", reason: "세로토닌 증후군, 경련" },
  { name: "구강청결제·치약", reason: "자일리톨·불소 중독" },
];

const CATEGORIES = [
  {
    emoji: "🪳",
    Icon: Bug,
    title: "구충제",
    color: "#6B8E6F",
    desc: "회충·벼룩·진드기·귀진드기 예방",
    items: [
      { name: "레볼루션", use: "목뒤 바르기 · 1개월 지속", range: "내·외부 종합" },
      { name: "브라벡토", use: "1회 · 3개월 지속", range: "벼룩·진드기" },
      { name: "애드보킷", use: "목뒤 · 1개월", range: "내·외부 종합" },
      { name: "프론트라인", use: "목뒤 · 1개월", range: "벼룩·진드기" },
    ],
  },
  {
    emoji: "💊",
    Icon: Heart,
    title: "영양제",
    color: "#E86B8C",
    desc: "노묘·회복기·특정 증상 보조",
    items: [
      { name: "락토 / 프로바이오틱스", use: "사료에 섞기", range: "설사·장 트러블" },
      { name: "오메가3 (EPA/DHA)", use: "사료에 소량", range: "피부·관절·노묘" },
      { name: "라이신(Lysine)", use: "구내염·허피스 보조", range: "면역력" },
      { name: "글루코사민/콘드로이틴", use: "노묘 관절", range: "관절 영양" },
    ],
  },
  {
    emoji: "👁️",
    Icon: Eye,
    title: "안약·귀약",
    color: "#4A7BA8",
    desc: "경미한 증상·청결 관리",
    items: [
      { name: "인공눈물(히알루론산)", use: "점안 1~3회/일", range: "건조·이물감" },
      { name: "플라본 안약 (Flavin)", use: "수의사 상담", range: "경미한 염증" },
      { name: "귀세정제 (에피오틱)", use: "주 1회", range: "귀지·염증 예방" },
    ],
  },
  {
    emoji: "🩹",
    Icon: Droplets,
    title: "응급·외용약",
    color: "#E88D5A",
    desc: "가벼운 상처·피부염",
    items: [
      { name: "생리식염수", use: "상처 세척", range: "얕은 상처" },
      { name: "메디트로핀 연고", use: "얇게 바르기", range: "피부 염증" },
      { name: "무균 거즈·탄력 붕대", use: "지혈·보호", range: "이송 전 처치" },
    ],
  },
];

interface GuideItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string;
  image_url: string | null;
  description: string;
  usage_info: string | null;
  tip: string | null;
  price: string | null;
  sort_order: number;
}

async function getGuideItems(): Promise<GuideItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pharmacy_guide_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as GuideItem[];
}

export default async function PharmacyGuidePage() {
  const items = await getGuideItems();

  return (
    <div className="px-4 pt-14 pb-24 max-w-[720px] mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <BackButton />
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight leading-snug">
            길고양이 약품·영양제 가이드
          </h1>
          <p className="text-[11px] text-text-sub mt-0.5">동물약국에서 구매 가능한 길고양이 돌봄 용품</p>
        </div>
      </div>

      {/* 주의사항 */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 mb-5"
        style={{
          background: "linear-gradient(135deg, #FBEAEA 0%, #FFF 100%)",
          borderRadius: 18,
          border: "1px solid rgba(216,85,85,0.15)",
        }}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "#D85555" }} />
        <div>
          <p className="text-[12px] font-bold leading-snug" style={{ color: "#B84545" }}>
            약품 사용 전 반드시 확인
          </p>
          <p className="text-[11px] text-text-sub mt-1 leading-relaxed">
            정확한 용량·투여 방법은 <strong>수의사 상담</strong> 필수.
            증상 심할 땐 동물병원부터 방문하세요. 본 가이드는 참고용입니다.
          </p>
        </div>
      </div>

      {/* 히어로 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #F0EDF7 0%, #EAE4F2 100%)",
          border: "1px solid rgba(155,109,215,0.2)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          길고양이 돌봄에는 <strong>구충제·영양제·응급 외용약</strong> 몇 가지만 갖춰두면 일상적 대응이 가능합니다.
          동물약국은 처방전 없이 살 수 있고 병원보다 저렴해요. 다만
          <strong className="mx-1">사람 약은 절대 금지</strong>, 증상 심하거나 오래가면 반드시 병원.
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
          <li><a href="#categories" className="hover:underline">카테고리별 필수 약품</a></li>
          <li><a href="#banned" className="hover:underline">⛔ 절대 주면 안 되는 사람 약</a></li>
          <li><a href="#items" className="hover:underline">상세 제품 카드</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 카테고리별 필수 약품 */}
      <section id="categories" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Pill size={20} color="#9B6DD7" />
          카테고리별 필수 약품
        </h2>
        <div className="space-y-3">
          {CATEGORIES.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl bg-white p-4"
              style={{ border: `1px solid ${c.color}20`, boxShadow: `0 3px 10px ${c.color}10` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 20 }}>{c.emoji}</span>
                <h3 className="text-[15px] font-extrabold" style={{ color: c.color }}>
                  {c.title}
                </h3>
              </div>
              <p className="text-[12.5px] text-text-sub mb-3 leading-relaxed">{c.desc}</p>
              <div className="space-y-1.5">
                {c.items.map((it) => (
                  <div
                    key={it.name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: `${c.color}08` }}
                  >
                    <span className="text-[12px] font-extrabold text-text-main shrink-0" style={{ minWidth: 90 }}>
                      {it.name}
                    </span>
                    <span className="text-[11px] text-text-sub flex-1">{it.use}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background: c.color, color: "#fff" }}
                    >
                      {it.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 절대 금지 */}
      <section id="banned" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Shield size={20} color="#D85555" />
          ⛔ 절대 주면 안 되는 사람 약·물질
        </h2>
        <p className="text-[13.5px] text-text-main leading-relaxed mb-3">
          많은 캣맘이 "도와주려다" 치명적 실수를 합니다. 아래 목록은 소량만으로도 중독·사망 가능성이 높은 것들이에요.
        </p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(216,85,85,0.2)" }}
        >
          {BANNED_DRUGS.map((d, i) => (
            <div
              key={d.name}
              className="flex items-start gap-3 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "#FBEAEA" : "#FDECEC",
                borderTop: i === 0 ? "none" : "1px solid rgba(216,85,85,0.1)",
              }}
            >
              <span style={{ fontSize: 16, marginTop: 2 }}>⛔</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold" style={{ color: "#8B2F2F" }}>
                  {d.name}
                </p>
                <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "#B84545" }}>
                  {d.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl p-4 text-[13px] leading-relaxed" style={{ background: "#F6F1EA" }}>
          <p className="font-bold text-text-main mb-1">🚨 중독 의심 시</p>
          <p className="text-text-sub">
            즉시 24시간 동물병원 이송. <strong>먹던 물질·용기</strong>를 함께 챙겨가면 진단·치료가 빨라집니다.
            응급 대응은 <Link href="/protection/emergency-guide" className="text-primary font-bold underline">응급 구조 가이드</Link> 참고.
          </p>
        </div>
      </section>

      {/* DB 기반 상세 카드 */}
      <section id="items" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Stethoscope size={20} color="#9B6DD7" />
          상세 제품 카드
        </h2>
        <p className="text-[12.5px] text-text-sub mb-4 leading-relaxed">
          도시공존 관리자가 직접 검증한 제품 정보입니다. 가격·사용법·주의사항을 확인하세요.
        </p>

        {items.length === 0 && (
          <div className="py-12 text-center text-[13px] text-text-sub rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
            아직 등록된 상세 약품이 없어요.
          </div>
        )}

        <div className="space-y-4">
          {items.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden"
              style={{
                background: "#FFFFFF",
                borderRadius: 22,
                boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} className="w-full h-48 object-cover" />
              )}
              {!p.image_url && (
                <div
                  className="w-full h-36 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${p.color}18 0%, ${p.color}08 100%)` }}
                >
                  <span className="text-[14px] font-bold" style={{ color: p.color }}>{p.category}</span>
                </div>
              )}

              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg" style={{ backgroundColor: p.color, color: "#fff" }}>
                    {p.category}
                  </span>
                  {p.brand && <span className="text-[10px] text-text-light">{p.brand}</span>}
                </div>
                <h3 className="text-[16px] font-extrabold text-text-main mb-2 leading-tight">{p.name}</h3>
                <p className="text-[13px] text-text-sub leading-relaxed mb-4">{p.description}</p>

                {p.usage_info && (
                  <div className="px-3.5 py-3 rounded-xl mb-2.5" style={{ backgroundColor: `${p.color}10` }}>
                    <p className="text-[11px] font-extrabold mb-1" style={{ color: p.color }}>사용법</p>
                    <p className="text-[12px] text-text-main leading-relaxed">{p.usage_info}</p>
                  </div>
                )}

                {p.tip && (
                  <div className="px-3.5 py-3 rounded-xl mb-3" style={{ backgroundColor: "#FDF9F2" }}>
                    <p className="text-[11px] font-extrabold mb-1 text-primary">💡 알아두세요</p>
                    <p className="text-[12px] text-text-main leading-relaxed">{p.tip}</p>
                  </div>
                )}

                {p.price && (
                  <span className="text-[13px] font-bold" style={{ color: p.color }}>{p.price}</span>
                )}
              </div>
            </article>
          ))}
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
              <p className="text-[13.5px] font-bold text-text-main">응급 구조 가이드</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">중독·부상 발생 시 대응법</p>
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
              <p className="text-[11.5px] text-text-sub mt-0.5">KMR 분유·연령별 급여</p>
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
              <p className="text-[11.5px] text-text-sub mt-0.5">처방·진료 가능한 동물병원</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 지도 CTA */}
      {items.length > 0 && (
        <div
          className="px-5 py-4 text-center"
          style={{
            background: "#FFFFFF",
            borderRadius: 18,
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <p className="text-[13px] font-bold text-text-main mb-1">가까운 동물약국 찾기</p>
          <p className="text-[11px] text-text-sub mb-3">지도에서 💊 보라색 마커를 탭하면 약국 정보를 확인할 수 있어요</p>
          <Link
            href="/map"
            className="inline-block px-5 py-2.5 rounded-xl text-[13px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #9B6DD7 0%, #7B4FBF 100%)",
              boxShadow: "0 6px 16px rgba(155,109,215,0.35)",
            }}
          >
            지도에서 동물약국 보기
          </Link>
        </div>
      )}

      {/* 신뢰 출처 */}
      <section className="mt-6 rounded-2xl p-4" style={{ background: "#F6F1EA", border: "1px solid rgba(0,0,0,0.04)" }}>
        <h3 className="text-[13px] font-bold text-text-main mb-2">참고한 출처</h3>
        <ul className="text-[12px] text-text-sub space-y-1 pl-4 list-disc leading-relaxed">
          <li>한국고양이수의사회 권장 투약 지침</li>
          <li>대한약사회 동물약국 가이드</li>
          <li>ASPCA (American Society for the Prevention of Cruelty to Animals) Toxicology Center</li>
          <li>VCA Animal Hospitals 고양이 약물 안내</li>
        </ul>
        <p className="text-[11px] text-text-light mt-3 leading-relaxed">
          본 가이드는 일반 참고용이며 <strong>수의사의 처방·진단을 대체하지 않습니다</strong>.
          개별 고양이의 건강 상태·알레르기·동반 질환에 따라 권장 약품이 달라지니 반드시 수의사 상담 후 사용하세요.
        </p>
      </section>
    </div>
  );
}
