// 길고양이 자주 묻는 질문 — SEO 랜딩 페이지
// FAQPage schema + long-tail 키워드 흡수 + 보호지침/병원/지도 페이지 내부 링크
// 서버 컴포넌트 (정적) — details/summary로 JS 없이 펼침 동작.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  HeartPulse,
  Baby,
  Home,
  Scissors,
  Scale,
  Users,
  Smartphone,
  ChevronDown,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";

export const metadata: Metadata = {
  title: "길고양이 자주 묻는 질문 — 발견·구조·TNR·입양 한눈에",
  description:
    "길고양이를 발견했을 때, 새끼고양이가 있을 때, TNR(중성화) 신청 방법, 임시보호·입양 절차, 학대 신고, 응급 처치, 케어테이커 활동까지. 시민이 가장 자주 묻는 30개 질문에 도시공존이 답해드려요.",
  alternates: { canonical: "/faq" },
  keywords: [
    "길고양이 발견",
    "길고양이 신고",
    "새끼고양이 발견",
    "아기고양이 구조",
    "TNR 신청",
    "중성화 수술",
    "길고양이 임시보호",
    "길고양이 입양",
    "길고양이 학대 신고",
    "케어테이커",
    "동물보호법",
    "길고양이 자주 묻는 질문",
    "도시공존",
  ],
  openGraph: {
    type: "website",
    title: "길고양이 자주 묻는 질문 | 도시공존",
    description:
      "발견·구조·TNR·임시보호·입양·학대 신고까지. 시민이 가장 자주 묻는 30개 질문에 답해드려요.",
    url: `${SITE_URL}/faq`,
    images: [{ url: `${SITE_URL}/faq/opengraph-image`, width: 1200, height: 630 }],
  },
};

// ─────────────────────────────────────────────────────────────
// 콘텐츠 — 질문/답변은 plain text. answerHtml은 답변 내 링크용.
// FAQPage schema에는 plain text(answer)만 들어가고, UI엔 answerHtml 표시.
// ─────────────────────────────────────────────────────────────

interface Faq {
  q: string;
  answer: string; // plain text — JSON-LD용
  answerHtml: React.ReactNode; // UI 표시용
}

interface FaqCategory {
  id: string;
  label: string;
  Icon: typeof AlertCircle;
  color: string;
  bg: string;
  items: Faq[];
}

const CATEGORIES: FaqCategory[] = [
  {
    id: "discover",
    label: "길고양이를 발견했어요",
    Icon: AlertCircle,
    color: "#C47E5A",
    bg: "rgba(196,126,90,0.12)",
    items: [
      {
        q: "길고양이를 처음 발견했어요. 어떻게 해야 하나요?",
        answer:
          "건강해 보이면 그냥 두는 게 가장 좋아요. 길고양이는 한 동네에서 영역을 가지고 살아가는 동물이라 멀리 옮기면 오히려 길을 잃어요. 다치거나 어린아이만 있는 경우에만 개입이 필요합니다. 도시공존 지도에 위치를 등록해 이웃과 함께 지켜봐 주세요.",
        answerHtml: (
          <>
            건강해 보이면 그냥 두는 게 가장 좋아요. 길고양이는 한 동네에서 영역을 가지고 살아가는 동물이라 멀리 옮기면 오히려 길을 잃어요. 다치거나 어린아이만 있는 경우에만 개입이 필요합니다.{" "}
            <Link href="/map" className="underline" style={{ color: "#A8684A" }}>
              도시공존 지도
            </Link>
            에 위치를 등록해 이웃과 함께 지켜봐 주세요.
          </>
        ),
      },
      {
        q: "다친 길고양이를 발견했어요. 어디로 신고하나요?",
        answer:
          "심각한 부상이면 가장 가까운 동물병원에 전화 후 이송하세요. 비용 부담이 크면 자치구 동물보호 담당부서(120 → 자치구 연결)로 연락해 구조 협조를 요청할 수 있어요. 도시공존의 응급 처치 가이드에서 첫 30분 대응법을 확인하실 수 있어요.",
        answerHtml: (
          <>
            심각한 부상이면 가장 가까운 동물병원에 전화 후 이송하세요. 비용 부담이 크면 자치구 동물보호 담당부서(120 → 자치구 연결)로 연락해 구조 협조를 요청할 수 있어요.{" "}
            <Link href="/protection/emergency-guide" className="underline" style={{ color: "#A8684A" }}>
              응급 처치 가이드
            </Link>
            에서 첫 30분 대응법을 확인하실 수 있고,{" "}
            <Link href="/hospitals" className="underline" style={{ color: "#A8684A" }}>
              구조동물 치료 병원
            </Link>{" "}
            목록에서 가까운 병원을 찾을 수 있어요.
          </>
        ),
      },
      {
        q: "길고양이 학대를 목격했어요. 어디에 신고하나요?",
        answer:
          "동물보호법 위반은 형사처벌 대상입니다. 경찰서(112)나 지자체 동물보호 담당부서에 신고하세요. 영상·사진 등 증거를 가능한 한 확보하는 게 좋습니다. 가해자 처벌 사례와 동물보호법 조항은 도시공존 동물보호법 정리 페이지에서 확인할 수 있어요.",
        answerHtml: (
          <>
            동물보호법 위반은 형사처벌 대상입니다. 경찰서(112)나 지자체 동물보호 담당부서에 신고하세요. 영상·사진 등 증거를 가능한 한 확보하는 게 좋습니다.{" "}
            <Link href="/protection/legal" className="underline" style={{ color: "#A8684A" }}>
              동물보호법 정리
            </Link>{" "}
            페이지에서 처벌 조항과 신고 절차를 확인할 수 있어요.
          </>
        ),
      },
      {
        q: "죽은 길고양이를 발견했어요. 어떻게 하나요?",
        answer:
          "120(다산 콜센터) 또는 자치구 청소행정과에 신고하면 사체 처리해 줍니다. 사유지에서 발견한 경우 토지 소유자가 처리 책임이 있어요. 학대 의심 정황이 있으면 사진을 찍어 두고 경찰에 함께 신고하세요.",
        answerHtml: (
          <>
            120(다산 콜센터) 또는 자치구 청소행정과에 신고하면 사체 처리해 줍니다. 사유지에서 발견한 경우 토지 소유자가 처리 책임이 있어요. 학대 의심 정황이 있으면 사진을 찍어 두고 경찰에 함께 신고하세요.{" "}
            <Link href="/protection/district-contacts" className="underline" style={{ color: "#A8684A" }}>
              시군구 담당부서 연락처
            </Link>
            를 한눈에 볼 수 있어요.
          </>
        ),
      },
      {
        q: "겁먹은 길고양이가 도망가지 않게 다가가는 법은?",
        answer:
          "낮은 자세로 천천히 다가가세요. 정면으로 눈을 마주치지 말고 옆쪽에서, 손을 아래로 내밀어 냄새 먼저 맡게 합니다. 갑작스러운 소리·움직임은 금물이에요. 평소 같은 시간에 같은 장소에서 사료를 두면 신뢰가 빨리 쌓여요.",
        answerHtml: (
          <>
            낮은 자세로 천천히 다가가세요. 정면으로 눈을 마주치지 말고 옆쪽에서, 손을 아래로 내밀어 냄새 먼저 맡게 합니다. 갑작스러운 소리·움직임은 금물이에요. 평소 같은 시간에 같은 장소에서 사료를 두면 신뢰가 빨리 쌓여요.{" "}
            <Link href="/protection/feeding-guide" className="underline" style={{ color: "#A8684A" }}>
              급식 가이드
            </Link>
            도 참고해 보세요.
          </>
        ),
      },
    ],
  },
  {
    id: "kitten",
    label: "새끼고양이를 발견했어요",
    Icon: Baby,
    color: "#E8B57E",
    bg: "rgba(232,181,126,0.18)",
    items: [
      {
        q: "혼자 있는 새끼고양이를 발견했어요. 데려가도 되나요?",
        answer:
          "성급한 구조가 가장 큰 위험이에요. 엄마 고양이가 사냥하러 갔거나 새끼를 옮기는 중일 수 있어요. 최소 2~4시간은 멀리서 관찰하세요. 엄마가 돌아오면 그대로 두는 게 새끼에게 가장 좋아요. 4시간이 지나도 어미가 안 오거나, 새끼가 차가워졌으면 그때 구조하세요.",
        answerHtml: (
          <>
            성급한 구조가 가장 큰 위험이에요. 엄마 고양이가 사냥하러 갔거나 새끼를 옮기는 중일 수 있어요. 최소 2~4시간은 멀리서 관찰하세요. 엄마가 돌아오면 그대로 두는 게 새끼에게 가장 좋아요. 4시간이 지나도 어미가 안 오거나, 새끼가 차가워졌으면 그때 구조하세요. 자세한 판단 기준은{" "}
            <Link href="/protection/kitten-guide" className="underline" style={{ color: "#A8684A" }}>
              새끼고양이 발견 가이드
            </Link>
            를 봐주세요.
          </>
        ),
      },
      {
        q: "아기 고양이가 차갑게 식어 있어요. 어떻게 응급조치하나요?",
        answer:
          "체온이 떨어진 새끼는 분유부터 먹이면 안 됩니다. 먼저 따뜻하게 데우세요. 미지근한 수건이나 핫팩(직접 접촉 금지, 천으로 감싸세요)으로 30분 이상 천천히 체온을 올린 후에 분유를 줍니다. 그 사이 가장 가까운 동물병원으로 이송하는 게 안전해요.",
        answerHtml: (
          <>
            체온이 떨어진 새끼는 분유부터 먹이면 안 됩니다. 먼저 따뜻하게 데우세요. 미지근한 수건이나 핫팩(직접 접촉 금지, 천으로 감싸세요)으로 30분 이상 천천히 체온을 올린 후에 분유를 줍니다. 그 사이 가장 가까운{" "}
            <Link href="/hospitals" className="underline" style={{ color: "#A8684A" }}>
              동물병원
            </Link>
            으로 이송하는 게 안전해요.
          </>
        ),
      },
      {
        q: "새끼고양이는 몇 시간마다 분유를 줘야 하나요?",
        answer:
          "1주차는 2시간마다(밤낮 모두), 2~3주차는 3~4시간마다, 4주차부터는 4~6시간마다 줍니다. 분유는 반드시 고양이 전용(사람·강아지 분유 X) 사용. 체온이 떨어졌으면 분유 전에 먼저 따뜻하게 해주세요. 30°C 정도가 가장 적정 체온이에요.",
        answerHtml: (
          <>
            1주차는 2시간마다(밤낮 모두), 2~3주차는 3~4시간마다, 4주차부터는 4~6시간마다 줍니다. 분유는 반드시 고양이 전용(사람·강아지 분유 X) 사용. 체온이 떨어졌으면 분유 전에 먼저 따뜻하게 해주세요. 30°C 정도가 가장 적정 체온이에요. 단계별 자세한 케어법은{" "}
            <Link href="/protection/kitten-guide" className="underline" style={{ color: "#A8684A" }}>
              새끼고양이 가이드
            </Link>
            에 정리돼 있어요.
          </>
        ),
      },
      {
        q: "새끼고양이의 나이는 어떻게 추정하나요?",
        answer:
          "눈을 감고 있으면 7일 미만, 눈을 떴으면 7~10일, 귀가 서면 2~3주, 걷고 뛰면 3~4주, 이가 모두 나면 6~8주차예요. 4주차부터는 이유식을 시작할 수 있고, 8주차부터는 입양 가능합니다.",
        answerHtml: (
          <>
            눈을 감고 있으면 7일 미만, 눈을 떴으면 7~10일, 귀가 서면 2~3주, 걷고 뛰면 3~4주, 이가 모두 나면 6~8주차예요. 4주차부터는 이유식을 시작할 수 있고, 8주차부터는 입양 가능합니다.
          </>
        ),
      },
    ],
  },
  {
    id: "tnr",
    label: "TNR(중성화)이 궁금해요",
    Icon: Scissors,
    color: "#A8684A",
    bg: "rgba(168,104,74,0.12)",
    items: [
      {
        q: "TNR이 정확히 뭔가요? 왜 필요한가요?",
        answer:
          "TNR은 Trap(포획) - Neuter(중성화 수술) - Return(원래 자리에 방사)의 약자예요. 무분별한 번식을 막아 길고양이 개체수를 안정시키고, 발정기 울음·영역 다툼·새끼의 어린 죽음을 줄이는 가장 인도적인 방법입니다. 살처분이 아닌 공존이 목표예요.",
        answerHtml: (
          <>
            TNR은 <strong>Trap</strong>(포획) - <strong>Neuter</strong>(중성화 수술) - <strong>Return</strong>(원래 자리에 방사)의 약자예요. 무분별한 번식을 막아 길고양이 개체수를 안정시키고, 발정기 울음·영역 다툼·새끼의 어린 죽음을 줄이는 가장 인도적인 방법입니다. 살처분이 아닌 공존이 목표예요.{" "}
            <Link href="/protection/trapping-guide" className="underline" style={{ color: "#A8684A" }}>
              TNR 요령 가이드
            </Link>
            에서 자세히 다뤘어요.
          </>
        ),
      },
      {
        q: "TNR을 시 비용은 누가 부담하나요?",
        answer:
          "대부분 자치구에서 무료 또는 보조금을 지원합니다. 신청 절차는 자치구마다 달라요. 동물보호 담당부서(120)나 도시공존의 시군구 담당부서 연락처에서 해당 구청 번호를 확인해 직접 문의하세요. 보통 연중 신청 가능하지만 예산 한도가 있어 조기 마감되는 곳도 있어요.",
        answerHtml: (
          <>
            대부분 자치구에서 무료 또는 보조금을 지원합니다. 신청 절차는 자치구마다 달라요. 동물보호 담당부서(120)나{" "}
            <Link href="/protection/district-contacts" className="underline" style={{ color: "#A8684A" }}>
              시군구 담당부서 연락처
            </Link>
            에서 해당 구청 번호를 확인해 직접 문의하세요. 보통 연중 신청 가능하지만 예산 한도가 있어 조기 마감되는 곳도 있어요.
          </>
        ),
      },
      {
        q: "이미 중성화된 고양이는 어떻게 알아보나요?",
        answer:
          "왼쪽 귀 끝이 1cm 정도 일직선으로 잘려 있으면 TNR 완료된 개체예요. 이를 '이어 컷(귀 표식)' 또는 'V-cut'이라고 부릅니다. 통증 없이 마취 중 처치되며, 다시 같은 고양이를 잡지 않게 하는 국제 표준이에요.",
        answerHtml: (
          <>
            왼쪽 귀 끝이 1cm 정도 일직선으로 잘려 있으면 TNR 완료된 개체예요. 이를 &lsquo;이어 컷(귀 표식)&rsquo; 또는 &lsquo;V-cut&rsquo;이라고 부릅니다. 통증 없이 마취 중 처치되며, 다시 같은 고양이를 잡지 않게 하는 국제 표준이에요.
          </>
        ),
      },
      {
        q: "TNR 후 회복은 얼마나 걸리나요?",
        answer:
          "수술 다음날 방사하는 것이 일반적이지만, 따뜻한 실내에서 2~3일 회복하는 게 가장 좋아요. 암컷은 더 긴 회복(3~5일)이 필요합니다. 회복 중에는 마른 사료와 물만, 케이지에서 안정 휴식. 출혈·고름·기력 저하가 보이면 즉시 병원으로.",
        answerHtml: (
          <>
            수술 다음날 방사하는 것이 일반적이지만, 따뜻한 실내에서 2~3일 회복하는 게 가장 좋아요. 암컷은 더 긴 회복(3~5일)이 필요합니다. 회복 중에는 마른 사료와 물만, 케이지에서 안정 휴식. 출혈·고름·기력 저하가 보이면 즉시 병원으로.
          </>
        ),
      },
    ],
  },
  {
    id: "shelter",
    label: "임시보호와 입양",
    Icon: Home,
    color: "#7AAE82",
    bg: "rgba(122,174,130,0.14)",
    items: [
      {
        q: "임시보호와 입양의 차이가 뭔가요?",
        answer:
          "임시보호는 입양 갈 곳을 찾는 동안 일정 기간(보통 2~8주) 우리 집에서 돌봐주는 거예요. 입양처가 나오면 보내야 합니다. 입양은 평생 가족으로 책임지는 것. 둘 다 동물보호단체나 개인 케어테이커를 통해 매칭됩니다.",
        answerHtml: (
          <>
            임시보호는 입양 갈 곳을 찾는 동안 일정 기간(보통 2~8주) 우리 집에서 돌봐주는 거예요. 입양처가 나오면 보내야 합니다. 입양은 평생 가족으로 책임지는 것. 둘 다 동물보호단체나 개인 케어테이커를 통해 매칭됩니다.{" "}
            <Link href="/protection/shelter-guide" className="underline" style={{ color: "#A8684A" }}>
              임시보호 시작 가이드
            </Link>
            를 참고하세요.
          </>
        ),
      },
      {
        q: "임시보호를 시작하려면 뭐가 필요한가요?",
        answer:
          "준비물: 케이지(또는 분리된 방), 사료, 물그릇, 화장실(모래), 스크래쳐, 장난감. 가장 중요한 건 격리 가능한 공간이에요. 기존 반려묘가 있으면 최소 2주 격리(전염병·기생충 체크). 시작 전 동물병원에서 기본 건강검진 필수.",
        answerHtml: (
          <>
            준비물: 케이지(또는 분리된 방), 사료, 물그릇, 화장실(모래), 스크래쳐, 장난감. 가장 중요한 건 격리 가능한 공간이에요. 기존 반려묘가 있으면 최소 2주 격리(전염병·기생충 체크). 시작 전{" "}
            <Link href="/hospitals" className="underline" style={{ color: "#A8684A" }}>
              동물병원
            </Link>
            에서 기본 건강검진 필수.
          </>
        ),
      },
      {
        q: "길고양이를 입양하려면 어떻게 해야 하나요?",
        answer:
          "동물보호관리시스템(animal.go.kr), 자치구 유기동물 보호소, 동물보호단체, 케어테이커 커뮤니티를 통해 입양 가능합니다. 도시공존에서도 곧 입양 매칭 기능이 들어올 예정이에요. 입양 전 임시보호로 한두 달 같이 살아보면 서로 적응하기 쉬워요.",
        answerHtml: (
          <>
            동물보호관리시스템(animal.go.kr), 자치구 유기동물 보호소, 동물보호단체, 케어테이커 커뮤니티를 통해 입양 가능합니다. 도시공존에서도 곧 입양 매칭 기능이 들어올 예정이에요. 입양 전 임시보호로 한두 달 같이 살아보면 서로 적응하기 쉬워요.
          </>
        ),
      },
      {
        q: "성묘 길고양이도 입양할 수 있나요?",
        answer:
          "물론이에요. 오히려 성격이 안정되어 있어 가족과 빠르게 친해지는 경우가 많아요. 아기 고양이는 활발하지만 손이 많이 가고, 성묘는 차분하지만 적응 기간이 필요해요. 둘 다 좋은 선택입니다. 야생성이 강한 개체는 실내 적응이 어려울 수 있어 사회화 정도를 먼저 확인하세요.",
        answerHtml: (
          <>
            물론이에요. 오히려 성격이 안정되어 있어 가족과 빠르게 친해지는 경우가 많아요. 아기 고양이는 활발하지만 손이 많이 가고, 성묘는 차분하지만 적응 기간이 필요해요. 둘 다 좋은 선택입니다. 야생성이 강한 개체는 실내 적응이 어려울 수 있어 사회화 정도를 먼저 확인하세요.
          </>
        ),
      },
    ],
  },
  {
    id: "health",
    label: "아프거나 다친 고양이",
    Icon: HeartPulse,
    color: "#D85555",
    bg: "rgba(216,85,85,0.12)",
    items: [
      {
        q: "길고양이가 자주 걸리는 병은 뭔가요?",
        answer:
          "허피스(눈곱·재채기), 칼리시(구내염), 범백혈구감소증(설사·구토, 새끼에게 치명적), 곰팡이성 피부병, 귀진드기, 벼룩 등이 대표적이에요. 사람에게 옮길 수 있는 인수공통감염병(톡소플라즈마 등)도 있으니 만진 후엔 손을 꼭 씻으세요.",
        answerHtml: (
          <>
            허피스(눈곱·재채기), 칼리시(구내염), 범백혈구감소증(설사·구토, 새끼에게 치명적), 곰팡이성 피부병, 귀진드기, 벼룩 등이 대표적이에요. 사람에게 옮길 수 있는 인수공통감염병(톡소플라즈마 등)도 있으니 만진 후엔 손을 꼭 씻으세요. 자세한 증상별 안내는{" "}
            <Link href="/protection/disease-guide" className="underline" style={{ color: "#A8684A" }}>
              질병 가이드
            </Link>
            를 봐주세요.
          </>
        ),
      },
      {
        q: "길고양이에게 약을 먹여도 되나요?",
        answer:
          "전문 수의사 처방 없이 임의로 약을 주는 건 위험해요. 사람 약(특히 타이레놀)은 고양이에게 치명적입니다. 다만 외부 기생충약·식이 보조제 등 일부는 동물약국에서 구입해 사용할 수 있어요. 도시공존의 약품 가이드에서 안전하게 사용할 수 있는 약 목록을 확인하세요.",
        answerHtml: (
          <>
            전문 수의사 처방 없이 임의로 약을 주는 건 위험해요. 사람 약(특히 타이레놀)은 고양이에게 치명적입니다. 다만 외부 기생충약·식이 보조제 등 일부는 동물약국에서 구입해 사용할 수 있어요.{" "}
            <Link href="/protection/pharmacy-guide" className="underline" style={{ color: "#A8684A" }}>
              약품 가이드
            </Link>
            에서 안전하게 사용할 수 있는 약 목록을 확인하세요.
          </>
        ),
      },
      {
        q: "구조한 길고양이의 첫 병원비는 얼마쯤 드나요?",
        answer:
          "기본 건강검진(항원검사·기생충검사·X-ray)만 해도 10~20만원, 치료까지 필요하면 30~100만원 이상도 나옵니다. 비용 부담이 크면 자치구 동물병원 보조 사업, 동물보호단체 의료비 지원, 크라우드펀딩(고양이 라이프 등)을 활용하세요.",
        answerHtml: (
          <>
            기본 건강검진(항원검사·기생충검사·X-ray)만 해도 10~20만원, 치료까지 필요하면 30~100만원 이상도 나옵니다. 비용 부담이 크면 자치구 동물병원 보조 사업, 동물보호단체 의료비 지원, 크라우드펀딩(고양이 라이프 등)을 활용하세요.{" "}
            <Link href="/hospitals" className="underline" style={{ color: "#A8684A" }}>
              구조동물 치료 병원
            </Link>{" "}
            중에는 케어테이커 할인이 있는 곳도 있어요.
          </>
        ),
      },
      {
        q: "발견한 고양이가 마이크로칩이 있는지 어떻게 확인하나요?",
        answer:
          "근처 동물병원에서 무료로 칩 스캔이 가능해요. 칩이 있으면 등록된 보호자에게 연락해 가족 곁으로 돌려보낼 수 있습니다. 길에서 사람을 따라오는 깨끗하고 살이 있는 고양이는 잃어버린 가정 고양이일 가능성이 높아요. 동물보호관리시스템에서도 유실 신고를 검색해 보세요.",
        answerHtml: (
          <>
            근처 동물병원에서 무료로 칩 스캔이 가능해요. 칩이 있으면 등록된 보호자에게 연락해 가족 곁으로 돌려보낼 수 있습니다. 길에서 사람을 따라오는 깨끗하고 살이 있는 고양이는 잃어버린 가정 고양이일 가능성이 높아요. 동물보호관리시스템(animal.go.kr)에서도 유실 신고를 검색해 보세요.
          </>
        ),
      },
    ],
  },
  {
    id: "law",
    label: "법·신고가 궁금해요",
    Icon: Scale,
    color: "#5F7A8E",
    bg: "rgba(95,122,142,0.12)",
    items: [
      {
        q: "케어테이커 활동은 합법인가요?",
        answer:
          "네, 합법입니다. 동물보호법은 길고양이 돌봄을 보호하고 있어요. 다만 타인의 사유지·공동주택 공용공간에서 무단으로 사료를 두는 건 갈등 소지가 있어요. 가능하면 관리실·이웃과 미리 협의하고, 사료 그릇은 식사 후 바로 회수해 청결을 유지하세요.",
        answerHtml: (
          <>
            네, 합법입니다. 동물보호법은 길고양이 돌봄을 보호하고 있어요. 다만 타인의 사유지·공동주택 공용공간에서 무단으로 사료를 두는 건 갈등 소지가 있어요. 가능하면 관리실·이웃과 미리 협의하고, 사료 그릇은 식사 후 바로 회수해 청결을 유지하세요.{" "}
            <Link href="/protection/legal" className="underline" style={{ color: "#A8684A" }}>
              동물보호법 정리
            </Link>
            도 함께 참고하세요.
          </>
        ),
      },
      {
        q: "길고양이 학대 신고하면 처벌은 어떻게 되나요?",
        answer:
          "동물보호법 제10조 위반은 최대 3년 이하 징역 또는 3,000만원 이하 벌금형이에요. 죽음에 이르게 한 경우 가중처벌. 영상·사진·목격자 진술 같은 증거가 중요합니다. 신고 시 본인 신원이 가해자에게 알려지지 않게 보호받을 수 있어요.",
        answerHtml: (
          <>
            동물보호법 제10조 위반은 최대 3년 이하 징역 또는 3,000만원 이하 벌금형이에요. 죽음에 이르게 한 경우 가중처벌. 영상·사진·목격자 진술 같은 증거가 중요합니다. 신고 시 본인 신원이 가해자에게 알려지지 않게 보호받을 수 있어요.
          </>
        ),
      },
      {
        q: "이웃이 길고양이에게 사료 주지 말라고 해요. 어떻게 하나요?",
        answer:
          "가능하면 대화로 해결하는 게 최선이에요. 사료 잔반·청결 문제 우려가 있다면 약속 시간에 와서 식사 후 회수, 사료 그릇 위치를 옮기는 등 절충안을 제시해 보세요. 협박·물리적 충돌로 이어지면 경찰에 신고하고 증거를 남기세요.",
        answerHtml: (
          <>
            가능하면 대화로 해결하는 게 최선이에요. 사료 잔반·청결 문제 우려가 있다면 약속 시간에 와서 식사 후 회수, 사료 그릇 위치를 옮기는 등 절충안을 제시해 보세요. 협박·물리적 충돌로 이어지면 경찰에 신고하고 증거를 남기세요. 자치구의 길고양이 돌봄 가이드라인이 있는 곳도 많아요 —{" "}
            <Link href="/protection/district-contacts" className="underline" style={{ color: "#A8684A" }}>
              자치구 담당부서
            </Link>
            에 문의해 보세요.
          </>
        ),
      },
    ],
  },
  {
    id: "caretaker",
    label: "케어테이커 활동",
    Icon: Users,
    color: "#9D7AB8",
    bg: "rgba(157,122,184,0.12)",
    items: [
      {
        q: "처음 케어테이커를 시작하려는데, 어떻게 해야 하나요?",
        answer:
          "급식 위치는 사람 동선과 떨어진 곳, 비를 피할 수 있는 곳이 좋아요. 정해진 시간에 정량 급여하고 식사 후 그릇을 회수하세요. 신선한 물도 함께. 추운 겨울엔 보온 쉼터를, 더운 여름엔 그늘을 만들어 주세요. 도시공존 지도에 위치를 등록하면 이웃과 정보 공유가 쉬워져요.",
        answerHtml: (
          <>
            급식 위치는 사람 동선과 떨어진 곳, 비를 피할 수 있는 곳이 좋아요. 정해진 시간에 정량 급여하고 식사 후 그릇을 회수하세요. 신선한 물도 함께. 추운 겨울엔 보온 쉼터를, 더운 여름엔 그늘을 만들어 주세요.{" "}
            <Link href="/map" className="underline" style={{ color: "#A8684A" }}>
              도시공존 지도
            </Link>
            에 위치를 등록하면 이웃과 정보 공유가 쉬워져요.
          </>
        ),
      },
      {
        q: "사료는 어떤 걸 주는 게 좋나요?",
        answer:
          "성분이 안정된 건식 사료가 보관·급여 모두 편해요. 너무 저렴한 사료는 옥수수·곡물 비중이 높아 영양 불균형이 올 수 있어요. 새끼·임신묘에겐 키튼용을, 노묘에겐 시니어용을. 여름철엔 사료가 빠르게 상하니 식사 후 바로 회수가 중요해요.",
        answerHtml: (
          <>
            성분이 안정된 건식 사료가 보관·급여 모두 편해요. 너무 저렴한 사료는 옥수수·곡물 비중이 높아 영양 불균형이 올 수 있어요. 새끼·임신묘에겐 키튼용을, 노묘에겐 시니어용을. 여름철엔 사료가 빠르게 상하니 식사 후 바로 회수가 중요해요.
          </>
        ),
      },
      {
        q: "겨울철 길고양이 보온은 어떻게 해주나요?",
        answer:
          "스티로폼 상자에 담요·짚을 깔고 입구를 작게 만든 겨울집이 가장 일반적이에요. 바닥에서 띄워 한기를 막고, 입구는 바람 방향과 반대쪽으로. 핫팩은 직접 접촉을 피하고 천으로 감싸 사용. 겨울집 위치는 사람 손이 잘 안 닿는 조용한 곳에 두세요.",
        answerHtml: (
          <>
            스티로폼 상자에 담요·짚을 깔고 입구를 작게 만든 겨울집이 가장 일반적이에요. 바닥에서 띄워 한기를 막고, 입구는 바람 방향과 반대쪽으로. 핫팩은 직접 접촉을 피하고 천으로 감싸 사용. 겨울집 위치는 사람 손이 잘 안 닿는 조용한 곳에 두세요.{" "}
            <Link href="/shelters" className="underline" style={{ color: "#A8684A" }}>
              우리 동네 쉼터 지도
            </Link>
            도 확인해 보세요.
          </>
        ),
      },
      {
        q: "케어테이커 활동 중 비용 지원받을 수 있나요?",
        answer:
          "사료·치료비 지원 사업이 자치구·동물보호단체별로 운영됩니다. 동물자유연대·카라·동물권행동 KARA 등 단체에서 매년 사료 지원, TNR 의료비 지원 등을 진행해요. 자치구 동물보호 담당부서에도 케어테이커 등록 후 지원받을 수 있는 프로그램이 있어요.",
        answerHtml: (
          <>
            사료·치료비 지원 사업이 자치구·동물보호단체별로 운영됩니다. 동물자유연대·카라·동물권행동 KARA 등 단체에서 매년 사료 지원, TNR 의료비 지원 등을 진행해요. 자치구 동물보호 담당부서에도 케어테이커 등록 후 지원받을 수 있는 프로그램이 있으니{" "}
            <Link href="/protection/district-contacts" className="underline" style={{ color: "#A8684A" }}>
              담당부서 연락처
            </Link>
            를 확인하세요.
          </>
        ),
      },
    ],
  },
  {
    id: "app",
    label: "도시공존 사용법",
    Icon: Smartphone,
    color: "#6B8DAE",
    bg: "rgba(107,141,174,0.14)",
    items: [
      {
        q: "도시공존은 어떤 앱인가요?",
        answer:
          "도시공존은 우리 동네 길고양이를 지도에 기록하고, 이웃 케어테이커와 돌봄 정보를 나누는 시민 참여 플랫폼이에요. 고양이 등록·돌봄다이어리·이웃 쪽지·동물병원 정보·긴급 구조·뉴스를 한 곳에서. 무료이고, 회원가입 후 우리 동네 길고양이부터 등록해 보세요.",
        answerHtml: (
          <>
            도시공존은 우리 동네 길고양이를 지도에 기록하고, 이웃 케어테이커와 돌봄 정보를 나누는 시민 참여 플랫폼이에요. 고양이 등록·돌봄다이어리·이웃 쪽지·동물병원 정보·긴급 구조·뉴스를 한 곳에서. 무료이고, 회원가입 후 우리 동네 길고양이부터 등록해 보세요.{" "}
            <Link href="/guide" className="underline" style={{ color: "#A8684A" }}>
              사용 가이드
            </Link>
            를 보면 빠르게 익숙해질 수 있어요.
          </>
        ),
      },
      {
        q: "길고양이를 등록하면 위치가 정확히 노출되나요?",
        answer:
          "아니요. 도시공존은 위치 프라이버시를 최우선으로 합니다. 등록한 좌표는 약 100m 단위로 퍼징(faceting)되어 표시돼요. 정확한 좌표는 본인과 검증된 이웃에게만 보이고, 학대 위험 방지를 위해 외부에는 일부러 흐릿하게 노출됩니다.",
        answerHtml: (
          <>
            아니요. 도시공존은 위치 프라이버시를 최우선으로 합니다. 등록한 좌표는 약 100m 단위로 퍼징(fuzzing)되어 표시돼요. 정확한 좌표는 본인과 검증된 이웃에게만 보이고, 학대 위험 방지를 위해 외부에는 일부러 흐릿하게 노출됩니다.
          </>
        ),
      },
      {
        q: "긴급 알림이 와요. 이게 뭔가요?",
        answer:
          "같은 동네에서 위급 상태(주의·위험)로 표시된 고양이가 며칠째 돌봄 기록이 없을 때, 동네 활동 유저에게 푸시 알림을 보내요. 가까운 분이 한 번 들러주시면 됩니다. 알림 받기 싫으시면 마이페이지 → 푸시 알림 설정에서 끌 수 있어요.",
        answerHtml: (
          <>
            같은 동네에서 위급 상태(주의·위험)로 표시된 고양이가 며칠째 돌봄 기록이 없을 때, 동네 활동 유저에게 푸시 알림을 보내요. 가까운 분이 한 번 들러주시면 됩니다. 알림 받기 싫으시면{" "}
            <Link href="/mypage" className="underline" style={{ color: "#A8684A" }}>
              마이페이지
            </Link>{" "}
            → 푸시 알림 설정에서 끌 수 있어요.
          </>
        ),
      },
      {
        q: "안드로이드 앱은 어디서 받을 수 있나요?",
        answer:
          "이제 Play 스토어에서 '도시공존'을 검색하거나 https://play.google.com/store/apps/details?id=kr.dosigongzon.app 에서 바로 설치할 수 있어요. iOS 등 다른 기기는 모바일 브라우저에서 dosigongzon.com에 접속한 후 '홈 화면에 추가'를 누르면 앱처럼 사용할 수 있어요.",
        answerHtml: (
          <>
            이제{" "}
            <a
              href="https://play.google.com/store/apps/details?id=kr.dosigongzon.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "#A8684A" }}
            >
              Play 스토어
            </a>
            에서 &lsquo;도시공존&rsquo;을 설치할 수 있어요. iOS 등 다른 기기는 모바일 브라우저에서{" "}
            <Link href="/" className="underline" style={{ color: "#A8684A" }}>
              dosigongzon.com
            </Link>
            에 접속한 후 &lsquo;홈 화면에 추가&rsquo;를 누르면 앱처럼 사용할 수 있어요.
          </>
        ),
      },
    ],
  },
];

// FAQPage schema 평탄화
function buildFaqJsonLd() {
  const mainEntity = CATEGORIES.flatMap((c) =>
    c.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.answer,
      },
    })),
  );
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

function buildBreadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "도시공존",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "자주 묻는 질문",
        item: `${SITE_URL}/faq`,
      },
    ],
  };
}

export default function FaqPage() {
  const faqJsonLd = buildFaqJsonLd();
  const breadcrumbJsonLd = buildBreadcrumbJsonLd();
  const totalQuestions = CATEGORIES.reduce((s, c) => s + c.items.length, 0);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-3">
        {/* 헤더 */}
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="홈으로"
          >
            <ArrowLeft size={18} color="#5C4A3E" />
          </Link>
          <p className="text-[12px]" style={{ color: "rgba(92,74,62,0.6)" }}>
            도시공존 / 자주 묻는 질문
          </p>
        </div>

        {/* 타이틀 */}
        <header className="mb-7">
          <h1
            className="mb-2 text-[26px] font-extrabold leading-tight"
            style={{ color: "#3D2F25" }}
          >
            길고양이 자주 묻는 질문
          </h1>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "rgba(92,74,62,0.78)" }}
          >
            발견·구조·TNR·임시보호·입양·학대 신고까지 — 시민이 가장 많이 묻는{" "}
            {totalQuestions}개 질문에 도시공존이 답해드려요.
          </p>
        </header>

        {/* 카테고리 목차 */}
        <nav
          aria-label="카테고리 목차"
          className="mb-7 rounded-2xl border p-4"
          style={{ borderColor: "rgba(196,126,90,0.18)", background: "rgba(255,253,250,0.7)" }}
        >
          <p
            className="mb-3 text-[12px] font-bold tracking-wide"
            style={{ color: "rgba(92,74,62,0.7)" }}
          >
            카테고리
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.Icon;
              return (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors active:scale-[0.98]"
                    style={{ background: c.bg, color: c.color }}
                  >
                    <Icon size={15} />
                    {c.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 카테고리 + 질문 */}
        {CATEGORIES.map((c) => {
          const Icon = c.Icon;
          return (
            <section key={c.id} id={c.id} className="mb-8 scroll-mt-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: c.bg }}
                >
                  <Icon size={17} color={c.color} />
                </span>
                <h2 className="text-[18px] font-extrabold" style={{ color: "#3D2F25" }}>
                  {c.label}
                </h2>
              </div>
              <div className="space-y-2">
                {c.items.map((it, idx) => (
                  <details
                    key={idx}
                    className="group rounded-2xl border bg-white px-4 py-3 transition-shadow open:shadow-md"
                    style={{ borderColor: "rgba(196,126,90,0.15)" }}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-start justify-between gap-3 text-[14px] font-semibold leading-snug"
                      style={{ color: "#3D2F25" }}
                    >
                      <span className="flex-1">Q. {it.q}</span>
                      <ChevronDown
                        size={18}
                        className="mt-0.5 shrink-0 text-[#A8684A] transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div
                      className="mt-3 text-[13.5px] leading-relaxed"
                      style={{ color: "rgba(60,46,35,0.85)" }}
                    >
                      {it.answerHtml}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}

        {/* 추가 도움 CTA */}
        <section
          className="mt-10 rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(196,126,90,0.08) 0%, rgba(232,181,126,0.12) 100%)",
            border: "1px solid rgba(196,126,90,0.18)",
          }}
        >
          <h3
            className="mb-2 text-[16px] font-extrabold"
            style={{ color: "#3D2F25" }}
          >
            여기 답이 없는 질문이 있나요?
          </h3>
          <p
            className="mb-4 text-[13px] leading-relaxed"
            style={{ color: "rgba(60,46,35,0.78)" }}
          >
            상세한 가이드는 보호지침에서 다루고 있어요. 그래도 답을 못 찾으면 메일로 문의주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/protection"
              className="rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white shadow-sm active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" }}
            >
              보호 지침 전체 보기
            </Link>
            <Link
              href="/guide"
              className="rounded-full border bg-white px-4 py-2 text-[12.5px] font-extrabold active:scale-[0.98]"
              style={{ borderColor: "rgba(196,126,90,0.3)", color: "#A8684A" }}
            >
              앱 사용 가이드
            </Link>
            <a
              href="mailto:grow29971@gmail.com"
              className="rounded-full border bg-white px-4 py-2 text-[12.5px] font-extrabold active:scale-[0.98]"
              style={{ borderColor: "rgba(196,126,90,0.3)", color: "#A8684A" }}
            >
              메일로 문의
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
