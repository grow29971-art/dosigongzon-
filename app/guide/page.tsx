import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Cat, Pencil, Heart, MessageCircle, MessageSquare,
  Users, Gift, Trophy, BookOpen, Bell, Download, Sparkles, ShieldAlert,
  Mail, Search, ArrowRight,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";

export const metadata: Metadata = {
  title: "사용 가이드 — 도시공존 200% 활용법",
  description:
    "도시공존의 모든 기능을 한눈에. 지도에 고양이 등록하는 법, 돌봄 일지 작성, 이웃과 소통, 긴급 알림, 업적과 레벨까지. 처음이라면 이 페이지부터.",
  alternates: { canonical: "/guide" },
  keywords: [
    "도시공존 사용법", "길고양이 지도 앱", "돌봄 일지", "고양이 등록 방법",
    "캣맘 커뮤니티", "TNR 기록", "도시공존 가이드",
  ],
  openGraph: {
    type: "website",
    title: "도시공존 사용 가이드",
    description: "처음이라면 이 페이지부터 — 10가지 핵심 기능 한눈에",
    url: `${SITE_URL}/guide`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

interface FeatureSection {
  groupLabel: string;
  groupColor: string;
  features: Feature[];
}

interface Feature {
  icon: typeof Cat;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
  steps?: string[];
  href: string;
  hrefLabel: string;
  tip?: string;
}

const SECTIONS: FeatureSection[] = [
  {
    groupLabel: "지도와 고양이",
    groupColor: "#C47E5A",
    features: [
      {
        icon: MapPin,
        iconColor: "#C47E5A",
        iconBg: "rgba(196,126,90,0.12)",
        title: "동네 길고양이 지도",
        desc: "우리 동네에 등록된 길고양이를 지도에서 한눈에. 고양이·병원·약국을 색깔로 구분해서 보여줘요.",
        steps: [
          "지도 상단 필터 칩으로 보고 싶은 종류만 선택",
          "마커 탭 → 고양이 프로필·돌봄 기록 보기",
          "우측 하단 '+' 버튼으로 새 아이 등록",
        ],
        href: "/map",
        hrefLabel: "지도 열기",
        tip: "🔒 정확한 위치는 로그인 유저에게만 근사치로 공개돼요. 비로그인은 동 단위로만.",
      },
      {
        icon: Cat,
        iconColor: "#6B8E6F",
        iconBg: "rgba(107,142,111,0.12)",
        title: "고양이 등록하기",
        desc: "지도 '+' 버튼을 누르면 등록 모달이 열려요. 사진·이름·성격 태그·건강 상태를 입력하면 끝.",
        steps: [
          "사진 1~3장 업로드 (WebP 자동 변환)",
          "이름·동네·성별·중성화 여부 선택",
          "성격 태그 (TNR 완료 · 겁 많음 · 사람 친화 등)",
          "건강 상태 (양호/주의/위험)",
        ],
        href: "/map",
        hrefLabel: "지금 등록하러 가기",
        tip: "🚨 건강 상태를 '위험'으로 설정하면 홈에 긴급 돌봄 표시되고 이웃에게 푸시돼요.",
      },
      {
        icon: Pencil,
        iconColor: "#48A59E",
        iconBg: "rgba(72,165,158,0.12)",
        title: "돌봄 일지 작성",
        desc: "밥·물·간식·건강 체크·TNR·병원 방문·쉼터 관리 7가지 활동을 기록. 매일 작성하면 연속 기록 보너스 점수.",
        steps: [
          "고양이 상세 페이지 → '돌봄 일지' 탭",
          "활동 종류 선택 (아이콘·색상으로 구분)",
          "메모 + 사진 첨부 (선택)",
        ],
        href: "/map",
        hrefLabel: "기록 시작",
        tip: "🔥 7일 연속 기록 시 +10점 · 30일 +30점 · 100일 +100점 + 업적 자동 해제.",
      },
    ],
  },
  {
    groupLabel: "소통과 커뮤니티",
    groupColor: "#4A7BA8",
    features: [
      {
        icon: MessageCircle,
        iconColor: "#4A7BA8",
        iconBg: "rgba(74,123,168,0.12)",
        title: "댓글 · 경보 · 리액션",
        desc: "고양이마다 이웃이 남긴 기록·경보를 확인하고 이모지로 반응할 수 있어요.",
        steps: [
          "댓글: 오늘 본 모습·상태 공유 (일반 기록)",
          "🚨 경보: 학대·위험 발견 시 (레벨 1+만 가능)",
          "이모지 반응: ❤️ 응원 · 🥺 안타까워 · 💪 힘내요 · 🙏 고마워",
        ],
        href: "/map",
        hrefLabel: "댓글 남기러 가기",
        tip: "경보는 가짜 난립 방지 위해 레벨 1 이상 유저만 쓸 수 있어요.",
      },
      {
        icon: Users,
        iconColor: "#8B65B8",
        iconBg: "rgba(139,101,184,0.12)",
        title: "커뮤니티 게시판",
        desc: "카테고리별 동네 이웃 이야기. 긴급 구조·임보 요청·입양 공고·용품 나눔까지.",
        steps: [
          "🔴 긴급: 당장 구조·신고 필요",
          "🟠 임보: 단기 보호 요청/제공",
          "💚 입양: 가족 찾기",
          "🛒 마켓: 사료·용품 나눔/판매",
          "💬 자유: 일상 이야기",
        ],
        href: "/community",
        hrefLabel: "커뮤니티 둘러보기",
      },
      {
        icon: MessageSquare,
        iconColor: "#E86B8C",
        iconBg: "rgba(232,107,140,0.12)",
        title: "1:1 쪽지 (DM)",
        desc: "다른 회원과 개인적으로 대화. 임보 상세 협의·입양 문의·동네 연락처 교환 등에 사용.",
        steps: [
          "프로필·댓글 옆 쪽지 아이콘 탭",
          "이미지 첨부 가능",
          "받으면 푸시·알림 센터로 즉시 알림",
        ],
        href: "/messages",
        hrefLabel: "쪽지함 열기",
      },
      {
        icon: Sparkles,
        iconColor: "#48A59E",
        iconBg: "rgba(72,165,158,0.12)",
        title: "지역 채팅 (동네 LIVE)",
        desc: "같은 구 이웃들과 실시간 대화. 지도 하단 💬 버튼으로 진입.",
        href: "/map",
        hrefLabel: "지도에서 채팅 열기",
        tip: "매주 금 저녁에 활발한 동네 채팅 알림이 옵니다 (설정 ON 시).",
      },
    ],
  },
  {
    groupLabel: "내 활동과 보상",
    groupColor: "#E88D5A",
    features: [
      {
        icon: Trophy,
        iconColor: "#E88D5A",
        iconBg: "rgba(232,141,90,0.12)",
        title: "레벨 · 업적",
        desc: "고양이 등록·돌봄 기록·경보·좋아요·초대·연속 돌봄으로 점수를 쌓아 7단계 레벨업.",
        steps: [
          "Lv.1 새싹 집사 → Lv.7 전설의 집사",
          "카테고리별 업적: 등록·기록·경보·공감·초대·꾸준함",
          "높은 레벨은 하루 등록 수·AI 챗 제한·프로필 테두리 혜택",
        ],
        href: "/mypage",
        hrefLabel: "내 레벨 확인",
      },
      {
        icon: Gift,
        iconColor: "#E86B8C",
        iconBg: "rgba(232,107,140,0.12)",
        title: "친구 초대",
        desc: "내 초대 코드로 친구가 가입하면 +15점 보너스 + 초대 업적 자동 해제. 카카오톡 공유 버튼 한 번에.",
        steps: [
          "마이페이지 최상단 '친구 초대' 핑크 카드",
          "링크 복사 or 카톡 공유",
          "친구 가입 시 알림 수신",
        ],
        href: "/mypage",
        hrefLabel: "내 코드 확인",
      },
    ],
  },
  {
    groupLabel: "정보와 가이드",
    groupColor: "#6B8E6F",
    features: [
      {
        icon: BookOpen,
        iconColor: "#6B8E6F",
        iconBg: "rgba(107,142,111,0.12)",
        title: "보호 지침",
        desc: "상황별 행동 매뉴얼. 응급처치부터 계절 쉼터까지.",
        steps: [
          "🚨 응급 구조 — 다친 아이 발견 시",
          "🐾 냥줍 가이드 — 새끼 고양이 구조",
          "✂️ TNR 포획 — 중성화 수술 절차",
          "🍚 먹이 가이드 — 금지 음식·안전 급식",
          "🏠 쉼터 · 겨울나기 — 스티로폼 집 DIY",
          "💊 약품 가이드 — 동물약국 구매 가이드",
          "⚖️ 법률 가이드 — 동물보호법·학대 신고",
          "📞 구청 연락처 — 시·군·구별 담당",
        ],
        href: "/protection",
        hrefLabel: "보호 지침 열기",
        tip: "공공기관 자료(동물보호관리시스템·식약처 등) 기반. 수의사의 진단·처방을 대체하지 않습니다.",
      },
      {
        icon: ShieldAlert,
        iconColor: "#D85555",
        iconBg: "rgba(216,85,85,0.12)",
        title: "🤖 AI 집사 챗봇",
        desc: "홈 화면 AI 집사 카드에서 길고양이 돌봄 관련 질문. 응급처치·먹이·행동 해석 등 상식선에서.",
        href: "/",
        hrefLabel: "홈에서 AI 집사 열기",
        tip: "AI 답변은 참고용이며 수의사 상담을 대체하지 않아요.",
      },
    ],
  },
  {
    groupLabel: "설정과 편의",
    groupColor: "#8B65B8",
    features: [
      {
        icon: Bell,
        iconColor: "#4A7BA8",
        iconBg: "rgba(74,123,168,0.12)",
        title: "알림 · 푸시",
        desc: "내 고양이에 달린 댓글·돌봄, 받은 쪽지, 초대 친구 가입 등을 알림 센터에서 확인.",
        steps: [
          "즉시 푸시: 쪽지·댓글·경보·돌봄 기록",
          "주기 푸시 (선택): 수요일 동네 소식 · 금요일 채팅 유도",
          "마이페이지에서 '동네 소식 푸시 받기' 옵션으로 제어",
        ],
        href: "/notifications",
        hrefLabel: "알림 센터 열기",
      },
      {
        icon: Mail,
        iconColor: "#E86B8C",
        iconBg: "rgba(232,107,140,0.12)",
        title: "주간 이메일 다이제스트",
        desc: "매주 월요일 아침, 이번 주 우리 동네 새 고양이 · 긴급 돌봄 요약을 메일로.",
        href: "/mypage",
        hrefLabel: "수신 설정",
        tip: "가입 시 '선택' 동의를 체크한 분께만 발송돼요. 언제든 마이페이지에서 OFF 가능.",
      },
      {
        icon: Download,
        iconColor: "#C47E5A",
        iconBg: "rgba(196,126,90,0.12)",
        title: "앱으로 설치 (PWA)",
        desc: "홈 화면에 설치하면 브라우저 탭 없이 앱처럼 열려요. 푸시 알림도 더 안정적.",
        steps: [
          "크롬·엣지: 마이페이지 '앱으로 설치하기' → 원탭 설치",
          "iOS 사파리: 공유 버튼 → '홈 화면에 추가'",
        ],
        href: "/mypage",
        hrefLabel: "설치 메뉴 열기",
      },
      {
        icon: Search,
        iconColor: "#22B573",
        iconBg: "rgba(34,181,115,0.12)",
        title: "지역별 랜딩",
        desc: "서울 25개 구 · 276개 동별 전용 페이지. 검색에서 '○○구 길고양이' 검색 시 바로 도착.",
        href: "/areas",
        hrefLabel: "구별 지도 보기",
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈으로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">홈</span>
      </div>

      {/* 히어로 */}
      <section className="px-5 pt-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
          <Heart size={12} style={{ color: "#C47E5A" }} />
          <span className="text-[11px] font-extrabold" style={{ color: "#C47E5A" }}>
            HOW TO USE
          </span>
        </div>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          도시공존 사용 가이드
        </h1>
        <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
          처음이시라면 여기부터 차근차근 읽어주세요.
          <br />
          <b className="text-text-main">10가지 핵심 기능</b>을 섹션별로 정리했어요.
        </p>

        <div className="flex gap-2 mt-4">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-primary text-white active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 14px rgba(196,126,90,0.3)" }}
          >
            <MapPin size={14} />
            <span className="text-[13px] font-extrabold">지도 먼저 가볼래요</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "#FFF", color: "#C47E5A", border: "1.5px solid #E8D4BD", fontSize: 13, fontWeight: 800 }}
          >
            가입하고 시작
          </Link>
        </div>
      </section>

      {/* 섹션별 가이드 */}
      {SECTIONS.map((section) => (
        <section key={section.groupLabel} className="px-5 mt-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: section.groupColor }} />
            <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
              {section.groupLabel}
            </h2>
          </div>
          <div className="space-y-3">
            {section.features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl p-4"
                  style={{
                    background: "#FFFFFF",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: f.iconBg }}
                    >
                      <Icon size={20} style={{ color: f.iconColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-extrabold text-text-main leading-tight">
                        {f.title}
                      </p>
                      <p className="text-[12.5px] text-text-sub mt-1 leading-relaxed">
                        {f.desc}
                      </p>
                    </div>
                  </div>

                  {f.steps && f.steps.length > 0 && (
                    <ul className="mt-3 space-y-1.5 pl-1">
                      {f.steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-text-main leading-relaxed">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-extrabold text-white mt-0.5"
                            style={{ background: f.iconColor }}
                          >
                            {i + 1}
                          </span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {f.tip && (
                    <div
                      className="mt-3 rounded-xl p-2.5 text-[11.5px] leading-relaxed"
                      style={{
                        background: `${f.iconColor}10`,
                        color: "#5A4A3E",
                      }}
                    >
                      💡 {f.tip}
                    </div>
                  )}

                  <Link
                    href={f.href}
                    className="inline-flex items-center gap-1 mt-3 text-[12px] font-extrabold active:scale-95 transition-transform"
                    style={{ color: f.iconColor }}
                  >
                    {f.hrefLabel}
                    <ArrowRight size={12} />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* 마지막 CTA */}
      <section className="px-5 mt-10">
        <div
          className="rounded-3xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
            boxShadow: "0 8px 24px rgba(196,126,90,0.3)",
          }}
        >
          <p className="text-[16px] font-extrabold text-white leading-snug">
            이제 동네 아이들에게 <br />
            인사하러 가볼까요? 🐾
          </p>
          <Link
            href="/map"
            className="inline-block mt-4 bg-white text-[13px] font-extrabold px-6 py-3 rounded-2xl active:scale-95 transition-transform"
            style={{ color: "#C47E5A" }}
          >
            지도 열기 →
          </Link>
        </div>
      </section>

      <section className="px-5 mt-6 text-center">
        <Link
          href="/about"
          className="text-[12px] text-text-sub underline"
        >
          도시공존이 왜 만들어졌나요? →
        </Link>
      </section>
    </div>
  );
}
