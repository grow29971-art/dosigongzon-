import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Stethoscope,
  Eye,
  Syringe,
  ShieldCheck,
  HelpCircle,
  Activity,
  Search,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const LAST_UPDATED = "2026-04-21";

export const metadata: Metadata = {
  title: "길고양이가 자주 걸리는 질병 가이드 — 증상별 대응과 예방",
  description:
    "허피스·칼리시(감기), 범백, FeLV, FIP, 구내염, 곰팡이성 피부염, 귀 진드기, 기생충, 신장질환 등 길고양이에게 흔한 10가지 질병의 증상·원인·대응·예방을 한 페이지에.",
  keywords: [
    "길고양이 질병", "고양이 감기", "허피스 바이러스", "칼리시 바이러스",
    "범백", "FPV", "FeLV", "FIP", "고양이 구내염",
    "곰팡이성 피부염", "개선충", "귀 진드기", "심장사상충",
    "길고양이 눈곱", "고양이 콧물", "고양이 설사", "길고양이 구조",
    "고양이 예방접종", "길고양이 건강", "도시공존",
  ],
  alternates: { canonical: "/protection/disease-guide" },
  openGraph: {
    title: "길고양이 질병 가이드 — 10가지 흔한 병 완전 정리 | 도시공존",
    description:
      "길고양이 감기부터 범백·FIP·피부병·신장질환까지. 증상·대응·예방을 한눈에.",
    url: `${SITE_URL}/protection/disease-guide`,
  },
  robots: { index: true, follow: true },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "길고양이가 자주 걸리는 질병 가이드 — 증상·대응·예방",
  image: `${SITE_URL}/icons/icon-512.png`,
  datePublished: "2026-04-21",
  dateModified: LAST_UPDATED,
  inLanguage: "ko-KR",
  author: { "@type": "Organization", name: "도시공존" },
  publisher: {
    "@type": "Organization",
    name: "도시공존",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/protection/disease-guide` },
  description:
    "길고양이에게 흔한 10가지 질병의 증상·원인·대응·예방. 공공 수의 가이드 기반 정리.",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "길고양이가 눈곱이 심하고 콧물을 흘려요. 어떻게 해야 하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "상부호흡기감염(허피스·칼리시 바이러스) 가능성이 매우 높아요. 새끼 고양이와 면역 저하 개체는 치명적일 수 있어 48시간 내 병원 권장. 눈이 감긴 채 붙어 있으면 따뜻한 식염수로 부드럽게 닦아주고, 잘 먹지 못하면 즉시 구조·이송.",
      },
    },
    {
      "@type": "Question",
      name: "새끼 고양이가 갑자기 설사·구토하며 축 늘어져요.",
      acceptedAnswer: {
        "@type": "Answer",
        text: "고양이 범백혈구감소증(FPV) 의심. 치사율이 매우 높은 응급 상황이에요. 탈수 진행이 빠르니 즉시 병원으로. 다른 고양이에게 전염력이 강하므로 접촉 최소화하고 격리.",
      },
    },
    {
      "@type": "Question",
      name: "FIP(전염성 복막염)는 정말 치료가 가능한가요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "과거엔 사실상 100% 치명적이었지만, GS-441524 등 항바이러스 치료제가 등장하며 생존률이 크게 올랐어요. 한국에서는 합법적 승인 전이라 의료진과 상담 후 개별 판단. 복수·흉수가 보이면 진단이 늦을수록 어려워지니 빠른 의심과 진단이 중요.",
      },
    },
    {
      "@type": "Question",
      name: "길고양이 피부병은 사람에게 옮나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "네, 곰팡이성 피부염(링웜)과 개선충은 인수공통 감염이에요. 맨손으로 만지지 말고 장갑·긴팔 착용, 접촉 후 손·팔뚝을 흐르는 물과 비누로 충분히 세척. 본인·가족에게 가려운 붉은 원형 반점이 나타나면 피부과 방문.",
      },
    },
    {
      "@type": "Question",
      name: "길고양이에게 예방접종을 어떻게 해줄 수 있나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "완전 길고양이에게 개별 접종은 현실적으로 어려워요. 대신 TNR 과정에서 동물병원이 종합백신·구충제를 함께 투여하는 경우가 많습니다. 중성화 수술 시 함께 요청하세요. 냥줍 직후라면 3차 접종까지 계획.",
      },
    },
  ],
};

const DISEASES: {
  id: string;
  name: string;
  emoji: string;
  severity: "high" | "mid" | "low";
  symptoms: string[];
  cause: string;
  response: string;
  prevention: string;
}[] = [
  {
    id: "uri",
    name: "상부호흡기감염 (허피스·칼리시)",
    emoji: "🤧",
    severity: "mid",
    symptoms: ["눈곱·고름 눈물", "재채기·콧물", "입맛 저하", "혀·입 궤양(칼리시)"],
    cause:
      "길고양이에게 가장 흔한 바이러스 감염. 밀집된 공간·스트레스·면역 저하 상황에서 빈발. 타액·콧물로 빠르게 전파되고, 허피스는 잠복 후 재발.",
    response:
      "가벼우면 따뜻한 환경·영양 보충으로 호전되지만 새끼·노묘·임신묘는 48시간 내 병원. 눈이 붙어 있으면 식염수로 부드럽게 닦고, 식욕 없으면 습식·가열한 사료로 냄새 강화.",
    prevention:
      "종합백신(3종/5종) 접종이 최선. TNR 시 병원에 함께 요청. 스트레스 최소화 · 쉼터 습도 관리.",
  },
  {
    id: "fpv",
    name: "고양이 범백혈구감소증 (FPV, 범백)",
    emoji: "☠️",
    severity: "high",
    symptoms: ["심한 설사·구토", "급격한 탈수", "무기력·체온 저하", "먹이 거부"],
    cause:
      "파보바이러스 계열의 치명적 감염. 감염묘의 배설물로 전파되며 환경에서 수개월 생존. 새끼 고양이 치사율이 매우 높음.",
    response:
      "즉시 병원 이송 — 응급. 수액·항바이러스·항생제 집중 치료 필요. 같은 공간 다른 고양이는 격리하고 배설물 접촉 도구는 염소계 소독.",
    prevention:
      "종합백신 포함. 구조 직후 임시 보호는 신규 개체와 격리하고 2주 관찰.",
  },
  {
    id: "felv",
    name: "고양이 백혈병 바이러스 (FeLV)",
    emoji: "🧬",
    severity: "high",
    symptoms: ["반복되는 감염", "체중 감소", "잇몸 창백·빈혈", "만성 설사·호흡기 증상"],
    cause:
      "타액·교미·서로 핥기로 전파되는 레트로바이러스. 길고양이 커뮤니티 내 누적 감염률이 높음. 면역계가 서서히 붕괴.",
    response:
      "FeLV/FIV 키트 검사로 확인. 양성이면 개별 관리하고 격리. 건강 유지·면역력 보조가 중심이고 완치약은 없음. 공격성 낮추기 위해 중성화 권장.",
    prevention:
      "TNR 후 FeLV 백신 접종 가능. 신규 개체 합사 전 검사 필수.",
  },
  {
    id: "fiv",
    name: "고양이 면역결핍증 (FIV, 고양이 에이즈)",
    emoji: "🩸",
    severity: "mid",
    symptoms: ["만성 구내염·잇몸 출혈", "반복 상처·농양", "체중 감소", "2차 감염 반복"],
    cause:
      "깊은 교상(물림)으로 주로 전파. 수컷 영역 다툼이 잦은 길고양이 커뮤니티에서 흔함. 사람·개에게 옮지 않음.",
    response:
      "키트 검사로 확인. 완치 불가지만 면역 관리와 2차 감염 대응으로 장기 생존 가능. 중성화로 싸움·교상 빈도 감소시키는 게 가장 큰 도움.",
    prevention:
      "중성화(TNR)가 제1 예방. 다묘 보호 시 합사 전 검사.",
  },
  {
    id: "fip",
    name: "고양이 전염성 복막염 (FIP)",
    emoji: "⚠️",
    severity: "high",
    symptoms: ["원인 모를 발열 반복", "복부 팽창(습식)·호흡곤란", "눈 포도막염", "신경 증상"],
    cause:
      "코로나바이러스의 변이체. 집단 생활·면역 스트레스에서 발병. 한 번 변이하면 개체 내에서 발병.",
    response:
      "과거엔 치명적이었지만 최근 GS-441524 계열 치료제로 생존율 대폭 상승. 한국 내 정식 승인 전이지만 수의사 상담 후 개별 판단. 조기 진단이 관건.",
    prevention:
      "위생·면역 관리. 밀집·스트레스 환경 개선. 새끼 입양 직후 집단 생활 피하기.",
  },
  {
    id: "stomatitis",
    name: "구내염 (Stomatitis)",
    emoji: "🦷",
    severity: "mid",
    symptoms: ["먹으면서 비명·통증", "침 흘림(침 줄)", "잇몸 붉고 부음", "입냄새 심함"],
    cause:
      "면역이 자기 구강 조직을 공격하는 만성 질환. FeLV·칼리시 동반 시 악화. 길고양이에서 매우 흔함.",
    response:
      "소염·통증 관리, 심하면 발치 수술이 가장 확실한 해결. 먹이는 통증 없는 부드러운 습식으로 바꾸고 체중 감소 주의.",
    prevention:
      "스트레스 감소·FeLV 검사. 조기에 치과 처치로 악화 예방.",
  },
  {
    id: "dermatitis",
    name: "피부 질환 (곰팡이성 피부염 · 개선충)",
    emoji: "🍄",
    severity: "mid",
    symptoms: ["둥근 탈모 반점", "비듬·딱지", "심한 가려움", "귀 밖 피부 각질"],
    cause:
      "곰팡이(링웜)·개선충 기생. 밀집·습한 환경에서 번짐. 사람에게도 옮는 인수공통 감염이라 주의.",
    response:
      "장갑·긴팔 착용하고 접촉. 병원에서 피부 긁힘 검사·우드램프 확인. 항진균제·약욕 치료. 본인에게 가려운 원형 반점이 생기면 피부과 방문.",
    prevention:
      "정기 구충(외부 기생충 포함). 쉼터 주기적 세척·햇볕 건조. 새끼 구조 시 격리 관찰 14일.",
  },
  {
    id: "ear-mites",
    name: "귀 진드기 (이어마이트)",
    emoji: "👂",
    severity: "low",
    symptoms: ["귀 속 검은 커피 찌꺼기 같은 각질", "귀 자주 긁음", "머리 흔들기", "귀 냄새"],
    cause:
      "진드기가 외이도에 기생. 길고양이 사이 접촉으로 빠르게 퍼짐. 감염 자체는 치명적이진 않지만 방치 시 중이염 진행.",
    response:
      "병원에서 귀 세정 후 점이약 투여. 단 한 번에 끝나지 않고 2~3주 재처치. 같은 공간 다른 고양이도 함께 치료.",
    prevention:
      "정기 구충제(브라벡토·레볼루션 등)는 귀 진드기도 커버.",
  },
  {
    id: "parasites",
    name: "기생충 (심장사상충·장내기생충)",
    emoji: "🪱",
    severity: "mid",
    symptoms: [
      "배가 빵빵한데 마름(회충)",
      "만성 설사·변 속 흰 조각(촌충)",
      "기침·호흡 이상(심장사상충)",
      "빈혈(중증 감염)",
    ],
    cause:
      "모기·벼룩·생고기 섭취 등 다양한 경로. 심장사상충은 모기 매개라 길고양이도 감염 가능성 있음.",
    response:
      "외부+내부 동시 구충제(예: 브로드라인·레볼루션 플러스) 월 1회. 심장사상충은 예방이 원칙이며 감염 확진 시 고양이용 치료 옵션은 제한적.",
    prevention:
      "월 1회 구충. 생고기·날생선 금지. 모기 많은 계절 쉼터 방충.",
  },
  {
    id: "ckd",
    name: "만성 신장질환 (CKD)",
    emoji: "💧",
    severity: "mid",
    symptoms: ["물 많이 마심·소변량 증가", "체중 감소·탈모", "구토·구취(암모니아)", "입맛 저하"],
    cause:
      "나이 드는 고양이의 흔한 질환. 길고양이는 탈수 스트레스가 만성화되기 쉬워 조기 발병 가능.",
    response:
      "혈액·소변 검사로 진단. 신장 처방식 + 수액 요법이 기본. 이미 진행됐다면 피하 수액을 주기적으로.",
    prevention:
      "항상 깨끗한 물 공급. 여름·겨울 수분 섭취 유도(습식 병행). 7세 이상으로 추정되면 정기 검진.",
  },
  {
    id: "trauma",
    name: "외상 · 교통사고 · 교상",
    emoji: "🚑",
    severity: "high",
    symptoms: ["절뚝임·체중 한쪽 빼기", "출혈·찢어진 상처", "숨 거침·입안 출혈", "영역 싸움 후 농양"],
    cause:
      "차량·싸움·학대. 길고양이 응급 구조 사례 중 가장 높은 비중.",
    response:
      "섣불리 만지지 말고 수건·담요로 감싸 이동 가방으로. 응급실 연락 후 이송. 경미한 찢어짐도 감염으로 농양 진행 빠름.",
    prevention:
      "중성화(영역 싸움 감소). 차도 인접 급식소 위치 재검토. CCTV 가리는 곳 피하기.",
  },
];

// 증상 → 의심 질병 빠른 역매칭
const SYMPTOM_MATRIX: { symptom: string; emoji: string; suspects: string[] }[] = [
  { symptom: "눈곱·콧물·재채기", emoji: "🤧", suspects: ["uri"] },
  { symptom: "심한 설사·구토", emoji: "💧", suspects: ["fpv", "parasites"] },
  { symptom: "입 주변 침·먹이 거부", emoji: "😿", suspects: ["stomatitis", "uri"] },
  { symptom: "둥근 탈모·비듬", emoji: "🍄", suspects: ["dermatitis"] },
  { symptom: "귀 긁음·검은 각질", emoji: "👂", suspects: ["ear-mites"] },
  { symptom: "체중 감소 + 반복 감염", emoji: "📉", suspects: ["felv", "fiv", "ckd"] },
  { symptom: "배 팽창 + 호흡곤란", emoji: "🚨", suspects: ["fip"] },
  { symptom: "출혈·절뚝임", emoji: "🚑", suspects: ["trauma"] },
];

const SEVERITY_META = {
  high: { label: "응급/위중", color: "#D85555", bg: "#FDECEC" },
  mid:  { label: "주의 관찰", color: "#E88D5A", bg: "#FFF1E6" },
  low:  { label: "경증",     color: "#6B8E6F", bg: "#E8F4E8" },
} as const;

export default function DiseaseGuidePage() {
  return (
    <div className="px-5 pt-12 pb-16 max-w-3xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

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
        길고양이 <span style={{ color: "#D85555" }}>질병</span> 가이드 — <br />
        증상·대응·예방 한눈에
      </h1>

      {/* 요약 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "linear-gradient(135deg, #FFF0F0 0%, #FFE1E1 100%)",
          border: "1px solid rgba(216,85,85,0.18)",
        }}
      >
        <p className="text-[13.5px] leading-relaxed text-text-main">
          길고양이에게 흔한 <strong>10가지 질병</strong>을 <strong>증상 · 원인 · 대응 · 예방</strong> 순으로 정리했어요.
          아래 매트릭스에서 증상으로 빠르게 매칭해보고, 응급 증후가 보이면 바로 병원으로 이송하세요.
        </p>
        <p className="text-[11px] text-text-sub mt-3">
          마지막 업데이트: {LAST_UPDATED} · 공공기관·수의 가이드 기반 정리. 특정 진단·처방은 반드시 수의사 상담.
        </p>
      </div>

      {/* 응급 경고 */}
      <div
        className="rounded-2xl p-4 mb-6 flex gap-3"
        style={{
          background: "#FFEFEF",
          border: "1.5px solid #D85555",
        }}
      >
        <AlertTriangle size={22} style={{ color: "#D85555" }} className="shrink-0 mt-0.5" />
        <div className="text-[12.5px] leading-snug">
          <p className="font-extrabold text-text-main mb-1">즉시 병원 — 이런 증상은 응급</p>
          <ul className="list-disc pl-4 space-y-0.5 text-text-sub">
            <li>심한 설사·구토 + 무기력 (범백 의심)</li>
            <li>호흡이 가쁘거나 복부가 빵빵함 (FIP·흉수)</li>
            <li>출혈·개방 상처·뚜렷한 골절</li>
            <li>48시간 이상 금식 + 체온 저하</li>
            <li>경련·의식 저하</li>
          </ul>
        </div>
      </div>

      {/* 목차 */}
      <nav aria-label="목차" className="rounded-2xl bg-white p-4 mb-6" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
        <p className="text-[11px] font-extrabold text-text-sub tracking-[0.1em] mb-2">목차</p>
        <ol className="text-[13px] space-y-1 text-text-main list-decimal pl-5">
          <li><a href="#matrix" className="hover:underline">증상 → 의심 질병 매트릭스</a></li>
          <li><a href="#diseases" className="hover:underline">흔한 질병 10가지 상세</a></li>
          <li><a href="#prevent" className="hover:underline">예방 체크리스트</a></li>
          <li><a href="#faq" className="hover:underline">자주 묻는 질문</a></li>
        </ol>
      </nav>

      {/* 증상 매트릭스 */}
      <section id="matrix" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Search size={20} color="#4A7BA8" />
          증상 → 의심 질병 매트릭스
        </h2>
        <p className="text-[13px] text-text-main leading-relaxed mb-3">
          아래 증상에서 시작해 연결된 질병 카드를 바로 확인해보세요.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {SYMPTOM_MATRIX.map((s) => (
            <div
              key={s.symptom}
              className="rounded-xl p-3 flex items-start gap-3"
              style={{
                background: "#F7F4EE",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} className="shrink-0">
                {s.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-text-main">{s.symptom}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {s.suspects.map((sid) => {
                    const d = DISEASES.find((x) => x.id === sid);
                    if (!d) return null;
                    return (
                      <a
                        key={sid}
                        href={`#${sid}`}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-bold"
                        style={{
                          background: SEVERITY_META[d.severity].bg,
                          color: SEVERITY_META[d.severity].color,
                        }}
                      >
                        {d.emoji} {d.name.split(" ")[0]}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 질병 상세 */}
      <section id="diseases" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Stethoscope size={20} color="#D85555" />
          흔한 질병 10가지 상세
        </h2>
        <div className="space-y-4">
          {DISEASES.map((d) => {
            const sev = SEVERITY_META[d.severity];
            return (
              <article
                key={d.id}
                id={d.id}
                className="rounded-2xl bg-white p-5 scroll-mt-20"
                style={{
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                  border: `1px solid ${sev.color}25`,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span style={{ fontSize: 32, lineHeight: 1 }} className="shrink-0">
                    {d.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15.5px] font-extrabold text-text-main tracking-tight leading-tight">
                        {d.name}
                      </h3>
                      <span
                        className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold shrink-0"
                        style={{ background: sev.bg, color: sev.color }}
                      >
                        {sev.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 증상 */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Eye size={12} style={{ color: "#C47E5A" }} />
                    <p className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "#C47E5A" }}>
                      SYMPTOMS · 증상
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {d.symptoms.map((s) => (
                      <li
                        key={s}
                        className="px-2 py-1 rounded-lg text-[11.5px] font-semibold"
                        style={{ background: "#F7F4EE", color: "#4A4A48" }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 원인 */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity size={12} style={{ color: "#8B65B8" }} />
                    <p className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "#8B65B8" }}>
                      CAUSE · 원인
                    </p>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-text-sub">{d.cause}</p>
                </div>

                {/* 대응 */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Stethoscope size={12} style={{ color: "#D85555" }} />
                    <p className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "#D85555" }}>
                      RESPONSE · 대응
                    </p>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-text-main">{d.response}</p>
                </div>

                {/* 예방 */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={12} style={{ color: "#6B8E6F" }} />
                    <p className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "#6B8E6F" }}>
                      PREVENTION · 예방
                    </p>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-text-sub">{d.prevention}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 예방 체크리스트 */}
      <section id="prevent" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <Syringe size={20} color="#6B8E6F" />
          예방 체크리스트
        </h2>
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #F0F7F0 0%, #E4F1E4 100%)",
            border: "1px solid rgba(107,142,111,0.25)",
          }}
        >
          <ul className="space-y-2 text-[13px] text-text-main">
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>TNR + 종합백신·구충</strong> 동시 진행 요청 (3종/5종 + 외/내부 기생충)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>급식소 주변 청결</strong> — 남은 사료 회수, 물 하루 2회 교체, 그릇 주기적 세척</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>쉼터는 건조·환기</strong>가 핵심. 습한 쉼터는 곰팡이성 피부염의 온상</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>신규 구조 개체는 14일 격리 관찰</strong> — 범백·FeLV 잠복기 대응</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>싸움 잦은 수컷은 중성화 우선</strong> — FIV 교상 전파 차단</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>월 1회 외·내부 구충</strong> 커버리지 있는 제품 추천 (수의사 상담)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">✅</span>
              <span><strong>접촉 후 손 씻기</strong> — 곰팡이성 피부염·개선충 인수공통 대비</span>
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-8 scroll-mt-20">
        <h2 className="flex items-center gap-2 text-[18px] font-extrabold text-text-main mb-3">
          <HelpCircle size={20} color="#4A7BA8" />
          자주 묻는 질문
        </h2>
        <div className="space-y-3">
          {faqSchema.mainEntity.map((q, i) => (
            <details
              key={i}
              className="rounded-2xl bg-white p-4 group"
              style={{ border: "1px solid rgba(0,0,0,0.05)" }}
            >
              <summary className="cursor-pointer text-[13.5px] font-extrabold text-text-main">
                Q. {q.name}
              </summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-sub">
                {q.acceptedAnswer.text}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 관련 페이지 */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/protection/emergency-guide"
          className="px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95"
          style={{ background: "#FFF1E6", color: "#C47E5A", border: "1px solid rgba(196,126,90,0.25)" }}
        >
          🚑 응급 구조 가이드
        </Link>
        <Link
          href="/protection/pharmacy-guide"
          className="px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95"
          style={{ background: "#F4EDFA", color: "#8B65B8", border: "1px solid rgba(139,101,184,0.25)" }}
        >
          💊 약품 가이드
        </Link>
        <Link
          href="/hospitals"
          className="px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95"
          style={{ background: "#E8F4E8", color: "#6B8E6F", border: "1px solid rgba(107,142,111,0.25)" }}
        >
          🏥 가까운 병원 찾기
        </Link>
      </div>

      {/* 면책 */}
      <p className="text-[10px] text-text-light mt-6 leading-relaxed">
        ⓘ 본 가이드는 공공기관·수의 자료를 바탕으로 일반 정보를 제공합니다. 개별 진단·처방은 반드시 동물병원을 통해 확인해주세요.
        특정 제품·제조사의 광고나 판매 유도와 무관합니다.
      </p>
    </div>
  );
}
