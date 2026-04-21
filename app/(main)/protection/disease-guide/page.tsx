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

interface DiseaseData {
  id: string;
  name: string;
  emoji: string;
  severity: "high" | "mid" | "low";
  // 짧은 pill 요약 (매트릭스용)
  symptoms: string[];
  // 단계·관점별 상세 증상
  symptomsDetail: {
    early: string[];        // 초기 — 쉽게 놓칠 수 있는 신호
    progressing: string[];  // 진행 — 관찰 시 바로 의심해야 하는 모습
    critical?: string[];    // 심각 — 즉시 병원
    distinctive: string;    // 이 질병을 구별하는 특징적 단서
  };
  cause: string;
  response: string;
  prevention: string;
}

const DISEASES: DiseaseData[] = [
  {
    id: "uri",
    name: "상부호흡기감염 (허피스·칼리시)",
    emoji: "🤧",
    severity: "mid",
    symptoms: ["눈곱·고름 눈물", "재채기·콧물", "입맛 저하", "혀·입 궤양(칼리시)"],
    symptomsDetail: {
      early: [
        "눈 안쪽(내안각)에 맑은 눈물이 고여 있음",
        "간헐적 재채기 — 하루에 몇 번 정도",
        "평소보다 털 고르기를 덜 함",
        "사료 냄새를 맡고 돌아서는 횟수 증가 (후각 저하)",
      ],
      progressing: [
        "눈곱이 노랗거나 초록빛으로 변함 — 2차 세균 감염 사인",
        "눈꺼풀이 부어 눈이 감긴 채 붙어있음 — 강제로 뜨지 말 것",
        "콧물이 끈적해지고 코로 숨쉬기 힘들어 입을 살짝 벌림",
        "허스키하게 변한 목소리 (칼리시)",
        "혀·입천장·잇몸에 붉은 궤양이 관찰됨 (칼리시 특징)",
        "체중 감소가 눈에 띔 — 등뼈·골반이 만져짐",
      ],
      critical: [
        "48시간 이상 완전 금식",
        "호흡이 거칠고 입 벌리고 숨쉬기 (개구호흡)",
        "탈수로 인한 무기력 — 건드려도 반응 약함",
        "신생묘·새끼의 경우 몇 시간 만에 치명적일 수 있음",
      ],
      distinctive:
        "눈·코·입 세 곳 중 둘 이상에서 동시에 증상. 재채기할 때 콧물이 튀면서 주변 전파되므로, 같은 쉼터 고양이들 중 여럿이 비슷한 증상이면 강하게 의심.",
    },
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
    symptomsDetail: {
      early: [
        "갑자기 은신처에서 안 나오고 웅크림",
        "평소 좋아하던 간식도 거부",
        "고열 (직장온 40℃ 이상) — 체온이 높아 귀·발바닥이 뜨거움",
        "사료 그릇을 보더니 구역질만 함",
      ],
      progressing: [
        "물처럼 흐르는 설사 — 종종 혈액이나 점액 섞임",
        "노랗거나 거품 섞인 구토 반복",
        "배를 만지면 통증 반응 (복부 압통)",
        "눈이 움푹 들어가 보임 — 심한 탈수 신호",
        "잇몸이 창백하거나 회색빛",
      ],
      critical: [
        "체온이 오히려 정상 이하로 떨어짐 (저체온증) — 이미 쇼크 진행 중",
        "피부를 잡아당기면 돌아오지 않음 (탈수 20% 이상)",
        "반응이 거의 없고 눈이 반쯤 감겨 있음",
        "발견 시점이 늦을수록 치사율 급상승 — 새끼는 24~48시간 내 사망 가능",
      ],
      distinctive:
        "'범백'은 백혈구 수치가 급락하는 병. 동일 장소에서 여러 마리가 동시에 설사·구토·급사하면 거의 확실. 환경에서 수개월 생존하므로 같은 공간 다른 아이 반드시 격리.",
    },
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
    symptomsDetail: {
      early: [
        "감염 초기엔 겉으로 티가 거의 안 남 (잠복기 길음)",
        "키트 검사로만 확인 가능한 경우가 많음",
        "나이에 비해 자주 감기(URI)에 걸리거나 오래 낫지 않음",
      ],
      progressing: [
        "체중이 서서히 빠짐 — 등뼈·갈비뼈 윤곽 드러남",
        "잇몸·혀 바닥이 창백하거나 회백색 (빈혈)",
        "반복되는 구내염·잇몸 출혈",
        "만성 설사 또는 대변이 거무튀튀함 (위장관 림프종)",
        "림프절(턱 아래·겨드랑이)이 부어 만져짐",
        "호흡기 증상이 완치되지 않고 반복",
      ],
      critical: [
        "림프종·백혈병으로 진행 — 종괴가 만져짐",
        "숨이 가빠지고 흉수가 차서 누워 있기도 힘듦",
        "심한 빈혈로 점막이 거의 흰색 — 수혈 필요 단계",
      ],
      distinctive:
        "'여러 증상이 동시에 + 반복되는 2차 감염'이 핵심. 영양·환경은 좋은데 자꾸 아프면 FeLV/FIV 키트 검사 필수. 젊은 개체가 림프종이면 80% 이상 FeLV 연관.",
    },
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
    symptomsDetail: {
      early: [
        "교상(물린) 상처가 잘 낫지 않고 곪음",
        "감염 초기엔 림프절만 살짝 부어 있어 놓치기 쉬움",
        "잠복기가 수년 — 싸움이 잦은 수컷에게 주의 관찰",
      ],
      progressing: [
        "잇몸 전체가 붉게 충혈되고 쉽게 피가 남 (구내염 동반률 50% 이상)",
        "같은 자리에서 농양이 반복 형성 — 짜내면 진한 노란 고름",
        "털이 푸석해지고 그루밍을 덜 함",
        "체중이 조금씩 지속적으로 감소",
        "감기·설사·피부병 등 2차 감염이 번갈아 옴",
      ],
      critical: [
        "말기엔 '고양이 에이즈'라 불릴 만큼 면역계 붕괴",
        "경미한 감염이 전신으로 퍼짐 (패혈증)",
        "신경 증상 (경련·균형 잃기) 나타나기도 함",
      ],
      distinctive:
        "'교상 이력 + 반복 농양 + 심한 구내염' 조합이면 거의 FIV. FeLV와 달리 림프종은 드물고 구강 병변이 유독 심한 게 특징. 사람·개에게 옮지 않음 (종 특이).",
    },
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
    symptomsDetail: {
      early: [
        "원인 없이 3~5일 이상 지속되는 발열 (일반 항생제 무반응)",
        "갑작스러운 식욕 저하와 체중 감소",
        "활동량이 눈에 띄게 줄고 구석에서 웅크림",
        "털 윤기가 빠르게 나빠짐",
      ],
      progressing: [
        "[습식] 배가 서서히 빵빵해지는데 체중은 빠짐 — 복수 (腹水)",
        "[습식] 만지면 물주머니처럼 찰랑거림",
        "[건식] 눈 안 홍채가 탁해지거나 색이 바뀜 (포도막염)",
        "[건식] 림프절 종대·황달·신장 종괴가 만져짐",
        "점막이 노랗게 변함 (황달)",
      ],
      critical: [
        "흉수가 차서 개구호흡 + 눕지 못하고 앉아서 숨쉬기",
        "비틀거림·경련·한쪽 마비 등 신경 증상 (뇌 침범)",
        "말기엔 의식 저하와 체온 저하",
      ],
      distinctive:
        "'원인 모를 반복 발열 + 점점 나빠지는 전반적 상태'가 시작점. 습식(복수)·건식(눈·장기)으로 나뉘는데 진행 속도는 습식이 훨씬 빠름. 과거엔 사실상 100% 치명적이었으나 GS-441524로 조기 진단 시 생존 가능.",
    },
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
    symptomsDetail: {
      early: [
        "평소보다 입 냄새가 부쩍 심해짐",
        "건사료를 씹다가 중단하거나 한쪽으로만 씹음",
        "그루밍 시간이 줄고 얼굴을 덜 씻음",
        "사료 그릇에 핏자국이 묻어 있음",
      ],
      progressing: [
        "먹다가 '앗' 하는 듯한 비명·울음 — 통증 신호",
        "입가에 침이 계속 흘러 턱 아래가 젖어 있음",
        "어금니 뒤쪽 안쪽 잇몸이 선명한 빨강 또는 자주색으로 부음",
        "혀를 잘 안 내밀고 혀 움직임이 부자연스러움",
        "건사료를 거부하고 부드러운 것만 간신히 먹음",
      ],
      critical: [
        "심한 통증으로 완전 금식",
        "체중 급감과 탈수 동반",
        "잇몸에서 자발적으로 피가 남",
      ],
      distinctive:
        "입 안쪽(어금니 뒤)의 '립프구성형질세포성 염증'이 특징적. 일반 치주염보다 훨씬 광범위하고 통증이 극심. FeLV/FIV 동반 확률이 높아 함께 검사 권장.",
    },
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
    symptomsDetail: {
      early: [
        "[곰팡이] 작고 둥근 탈모 반점 — 처음엔 동전만 한 크기",
        "[개선충] 귀 바깥·가장자리부터 비듬·각질 시작",
        "그루밍이 평소보다 잦아짐",
        "가려움으로 몸을 벽·바닥에 비빔",
      ],
      progressing: [
        "[곰팡이] 탈모 반점이 여러 군데로 번짐 — 둥근 모양 유지",
        "[곰팡이] 반점 중심은 회색·가장자리는 붉은 링 형태",
        "[개선충] 귀 가장자리·눈 주변·팔꿈치가 두꺼워지며 각질 딱지",
        "[개선충] 극심한 가려움으로 피부가 상할 정도로 긁음",
        "긁혀서 생긴 상처로 2차 세균 감염 (진물·고름)",
      ],
      critical: [
        "전신으로 퍼진 탈모와 감염",
        "면역 저하로 다른 질병 동반 발병",
        "새끼·노묘는 탈수·영양 실조로 진행",
      ],
      distinctive:
        "곰팡이(링웜)는 '둥근 탈모', 개선충은 '귀 바깥부터 각질·극심한 가려움'이 특징. 둘 다 인수공통 감염. 다룰 때 반드시 장갑·긴팔 착용, 접촉 후 비누 세척.",
    },
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
    symptomsDetail: {
      early: [
        "가끔 머리를 세게 흔듦 (귀 속 불편감)",
        "귓구멍 안쪽에 작은 검은 점들이 보임",
        "귀 뒤쪽을 뒷발로 자주 긁음",
      ],
      progressing: [
        "귀 속이 갈색~검정 커피 찌꺼기 같은 각질로 가득 참",
        "귀에서 시큼한 냄새가 남",
        "고개가 한쪽으로 기울어짐 (평형 이상)",
        "긁다가 귀 안쪽·밖에 피딱지·상처",
      ],
      critical: [
        "방치 시 외이염 → 중이염 → 내이염으로 진행",
        "내이염이 되면 균형 잡기 어려워 비틀거림",
        "드물게 고막 손상 · 청력 저하",
      ],
      distinctive:
        "'검은 커피 찌꺼기 같은 귀 각질 + 머리 흔들기' 두 가지면 거의 확실. 한 마리가 걸렸으면 같은 공간의 다른 고양이도 높은 확률로 감염. 사람에게는 안 옮지만 개에게는 옮길 수 있음.",
    },
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
    symptomsDetail: {
      early: [
        "털이 푸석하고 그루밍해도 윤기가 없음",
        "변이 평소보다 무르거나 형태가 자주 바뀜",
        "식욕은 있는데 체중이 안 늘거나 빠짐",
      ],
      progressing: [
        "[회충] 배만 빵빵하게 부풀고 나머지는 마름 — '탁구공 실루엣'",
        "[회충] 구토물에 국수 가락 같은 흰 벌레가 섞임",
        "[촌충] 항문 주변·변 표면에 쌀알 크기의 흰 조각",
        "[촌충] 항문을 바닥에 끌며 문지름",
        "[심장사상충] 마른기침을 반복, 운동 후 숨이 참",
        "잇몸이 창백해지고 쉽게 지침 (빈혈)",
      ],
      critical: [
        "[심장사상충] 갑작스러운 실신·급사도 가능",
        "중증 회충 감염은 장 폐색 유발",
        "새끼는 중증 감염 시 탈수·저혈당으로 위급",
      ],
      distinctive:
        "장내기생충은 변·구토물에서 실제 벌레 또는 조각이 보이는 게 결정적. 심장사상충은 증상만으로 알기 어려워 키트 검사 필수. 고양이는 감염 자체가 드물지만 걸리면 치료 옵션이 제한적이라 예방이 전부.",
    },
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
    symptomsDetail: {
      early: [
        "물을 유독 자주 마시러 옴 (다음증)",
        "소변 색이 연해지고 양이 늘어남 (다뇨)",
        "식사 후 잠깐 구토하는 일이 잦아짐",
        "털이 푸석해지고 비듬이 늘어남",
      ],
      progressing: [
        "입에서 암모니아/쉰 우유 같은 독특한 냄새",
        "체중이 서서히 빠짐 — 등뼈·골반이 드러남",
        "잇몸이 창백해지고 입안에 궤양이 생김",
        "입맛을 잃어 좋아하던 음식도 거부",
        "평소보다 잠이 많아지고 은신처에 오래 머뭄",
        "구토 빈도가 늘고 가끔 토한 것에 피가 섞임",
      ],
      critical: [
        "완전 금식과 심한 탈수",
        "경련·착란 등 요독증 증상",
        "눈이 움푹 들어가고 반응이 거의 없음",
      ],
      distinctive:
        "'물 많이 마시고 오줌 많이 누는' 패턴 + 체중 감소 조합이 시그니처. 나이 많은 개체에서 매우 흔하며 초기에 잡을수록 수명을 크게 늘릴 수 있음. 길고양이는 탈수 스트레스가 쌓여 젊은 나이에도 발병 가능.",
    },
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
    symptomsDetail: {
      early: [
        "한쪽 다리를 들거나 덜 딛음 (파행)",
        "평소 올라가던 곳에 오르지 못함",
        "특정 부위를 자주 핥거나 만지면 피함",
        "싸움 후 털이 한 움큼 빠져 있음",
      ],
      progressing: [
        "[교통사고] 입·코에서 피가 나거나 잇몸이 찢어짐",
        "[교통사고] 호흡이 가쁘고 배가 이상하게 들썩임 (내부 출혈 가능)",
        "[낙상·차량] 동공 크기가 양쪽이 다름 (뇌진탕·두개 외상)",
        "[교상] 2~3일 후 물렸던 부위가 단단한 혹(농양)으로 부풀어 오름",
        "[교상] 혹을 눌렀을 때 따뜻하고 고양이가 통증 반응",
        "열이 나고 기운이 없어짐",
      ],
      critical: [
        "입·코·항문 등에서 선홍색 출혈 지속",
        "다리 뼈가 비정상적인 각도로 꺾임",
        "의식이 흐려지고 숨소리가 '꾸르르' 잡소리",
        "잇몸이 창백하거나 회색 — 심한 출혈 쇼크",
      ],
      distinctive:
        "외상은 육안으로 확인 가능한 경우가 많지만 '내부 출혈'은 초기엔 겉에 티가 안 나므로 사고 후 최소 12시간은 밀착 관찰. 교상은 2~5일 후 농양으로 드러나는 특성이 있어 '싸움 후 일주일'은 주시.",
    },
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

                {/* 증상 — 단계별 상세 */}
                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye size={12} style={{ color: "#C47E5A" }} />
                    <p className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "#C47E5A" }}>
                      SYMPTOMS · 증상
                    </p>
                  </div>

                  {/* 요약 pill */}
                  <ul className="flex flex-wrap gap-1.5 mb-3">
                    {d.symptoms.map((s) => (
                      <li
                        key={s}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: "#F7F4EE", color: "#4A4A48" }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>

                  {/* 단계별 */}
                  <div className="space-y-2">
                    {/* 초기 */}
                    <div
                      className="rounded-xl p-3"
                      style={{ background: "#F0F7F0", border: "1px solid rgba(107,142,111,0.20)" }}
                    >
                      <p
                        className="text-[10.5px] font-extrabold tracking-[0.1em] mb-1.5 flex items-center gap-1"
                        style={{ color: "#3F7B3F" }}
                      >
                        <span>●</span> 초기 — 쉽게 놓치는 신호
                      </p>
                      <ul className="space-y-1 text-[12.5px] text-text-main leading-snug">
                        {d.symptomsDetail.early.map((s) => (
                          <li key={s} className="flex gap-1.5">
                            <span className="shrink-0" style={{ color: "#6B8E6F" }}>·</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 진행 */}
                    <div
                      className="rounded-xl p-3"
                      style={{ background: "#FFF1E6", border: "1px solid rgba(232,141,90,0.25)" }}
                    >
                      <p
                        className="text-[10.5px] font-extrabold tracking-[0.1em] mb-1.5 flex items-center gap-1"
                        style={{ color: "#C4621E" }}
                      >
                        <span>●●</span> 진행 — 바로 의심
                      </p>
                      <ul className="space-y-1 text-[12.5px] text-text-main leading-snug">
                        {d.symptomsDetail.progressing.map((s) => (
                          <li key={s} className="flex gap-1.5">
                            <span className="shrink-0" style={{ color: "#E88D5A" }}>·</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 심각 (있으면) */}
                    {d.symptomsDetail.critical && (
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "#FDECEC", border: "1px solid rgba(216,85,85,0.25)" }}
                      >
                        <p
                          className="text-[10.5px] font-extrabold tracking-[0.1em] mb-1.5 flex items-center gap-1"
                          style={{ color: "#A73838" }}
                        >
                          <span>●●●</span> 심각 — 즉시 병원
                        </p>
                        <ul className="space-y-1 text-[12.5px] text-text-main leading-snug">
                          {d.symptomsDetail.critical.map((s) => (
                            <li key={s} className="flex gap-1.5">
                              <span className="shrink-0" style={{ color: "#D85555" }}>·</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 구별 팁 */}
                    <div
                      className="rounded-xl p-3"
                      style={{ background: "#F4EDFA", border: "1px solid rgba(139,101,184,0.20)" }}
                    >
                      <p
                        className="text-[10.5px] font-extrabold tracking-[0.1em] mb-1"
                        style={{ color: "#6E4EA0" }}
                      >
                        💡 이 질병 구별 팁
                      </p>
                      <p className="text-[12.5px] leading-relaxed text-text-main">
                        {d.symptomsDetail.distinctive}
                      </p>
                    </div>
                  </div>
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
