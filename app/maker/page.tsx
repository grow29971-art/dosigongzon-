import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Code2,
  Cpu,
  CircuitBoard,
  Box,
  Wrench,
  Bot,
  Heart,
  ShieldCheck,
  Sparkles,
  Hand,
  Coffee,
} from "lucide-react";

const SITE_URL = "https://dosigongzon.com";
const CONTACT_EMAIL = "grow29971@gmail.com";

export const metadata: Metadata = {
  title: "운영 이야기 — 도시공존을 만든 사람",
  description:
    "도시공존은 1인 메이커 김성우가 SW·HW·운영까지 직접 만들고 굴리는 비영리 시민 참여 플랫폼입니다. 케어테이커 한 분의 손이 헛되지 않게 — 이 한 가지를 위해 시작됐어요.",
  alternates: { canonical: "/maker" },
  openGraph: {
    type: "website",
    title: "운영 이야기 | 도시공존",
    description: "1인 메이커가 SW·HW·운영까지 직접 만든 비영리 시민 참여 플랫폼.",
    url: `${SITE_URL}/maker`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

export default function MakerPage() {
  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">홈</span>
      </div>

      {/* 히어로 */}
      <section className="px-5 pt-6">
        <p className="text-[10.5px] font-extrabold tracking-[0.18em] mb-2" style={{ color: "#A8684A" }}>
          MADE BY ONE NEIGHBOR
        </p>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          이 플랫폼,
          <br />
          <span style={{ color: "#A8684A" }}>한 사람이 직접 만들었어요.</span>
        </h1>
        <p className="text-[13.5px] text-text-sub mt-3 leading-relaxed">
          <b className="text-text-main">김성우</b> · 1인 풀스택 메이커
          <br />
          Software · Hardware · Product · Operations
        </p>
      </section>

      {/* 시작한 이유 */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={14} style={{ color: "#E86B8C" }} />
          <h2 className="text-[14px] font-extrabold text-text-main">왜 시작했나</h2>
        </div>
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #F4E8D8 100%)",
            border: "1px solid rgba(196,126,90,0.20)",
          }}
        >
          <p className="text-[13px] leading-[2] text-text-sub">
            매일 밥자리에 들러 사료를 채우고, 비 오는 날엔 우산 든 채 한참을 기다리고,
            누가 알아주지 않아도 그 아이가 오늘 잘 있는지 한 번 더 둘러보는 케어테이커들이
            계십니다.
          </p>
          <p className="text-[13px] leading-[2] text-text-sub mt-3">
            그 손이 흩어진 채로 끝나지 않게 — 같은 동네 이웃끼리 정보를 잇고,
            기록 한 줄이 다음 사람의 안심으로 이어지게 만들고 싶었어요.{" "}
            <b className="text-text-main">
              "케어테이커 한 분의 손이 헛되지 않게."
            </b>{" "}
            이 한 문장이 도시공존의 시작입니다.
          </p>
        </div>
      </section>

      {/* 만드는 방식 — 한 사람 풀스택 */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "#C47E5A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main">어떻게 만드나</h2>
        </div>
        <div className="bg-white rounded-3xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] leading-[1.95] text-text-sub mb-4">
            기획·디자인·개발·운영·고객 응대까지 모두 직접 합니다.
            소프트웨어만 다루지 않고{" "}
            <b className="text-text-main">물리적으로 손에 잡히는 영역</b>까지 만들어요.
            화면 너머의 문제도 도구로 해결할 수 있다는 뜻이죠.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <SkillCard
              icon={<Code2 size={14} />}
              title="풀스택 개발"
              sub="웹·앱·API·DB·인프라"
            />
            <SkillCard
              icon={<Cpu size={14} />}
              title="임베디드·IoT"
              sub="Arduino·ESP·센서·통신"
            />
            <SkillCard
              icon={<CircuitBoard size={14} />}
              title="PCB·회로"
              sub="설계·납땜·디버깅"
            />
            <SkillCard
              icon={<Box size={14} />}
              title="3D 프린팅·CAD"
              sub="외형·케이스·프로토타입"
            />
            <SkillCard
              icon={<Wrench size={14} />}
              title="기구·메카트로닉스"
              sub="모터·액츄에이터·조립"
            />
            <SkillCard
              icon={<Bot size={14} />}
              title="AI 통합"
              sub="LLM·비전·자동화"
            />
          </div>

          <p className="text-[12px] leading-[1.95] text-text-sub mt-4">
            소프트웨어 한 줄, 회로 한 가닥, 도면 한 장이 모여
            길 위의 아이들에게 닿을 수 있다고 믿어요.
            이 플랫폼은 그 믿음에서 출발했습니다.
          </p>
        </div>
      </section>

      {/* 운영 원칙 — 자비 운영 */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} style={{ color: "#4F6B53" }} />
          <h2 className="text-[14px] font-extrabold text-text-main">어떻게 굴러가나</h2>
        </div>
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(107,142,111,0.10) 0%, rgba(107,142,111,0.04) 100%)",
            border: "1px solid rgba(107,142,111,0.22)",
          }}
        >
          <PrincipleRow
            emoji="💛"
            title="광고도, 유료 구독도, 데이터 판매도 없습니다"
            body="서버·도메인·AI 사용료·하드웨어 부품비까지 모두 운영자가 자비로 부담해요. 그래서 단체·정당·기업과 무관하게 중립을 지킬 수 있습니다."
          />
          <PrincipleRow
            emoji="🛡"
            title="아이들의 안전이 1순위"
            body="좌표는 동(洞) 단위로만 흐려서 저장하고, 비로그인 외부인에게는 도트와 카운트만 노출돼요. 사진 GPS 메타데이터(EXIF)는 업로드 시 자동 제거합니다."
          />
          <PrincipleRow
            emoji="🤝"
            title="시민이 만드는 시민의 도구"
            body="기록·돌봄·소통의 주체는 케어테이커와 시민이에요. 운영자는 그 손이 더 멀리 닿을 수 있게 도구를 만들고 유지할 뿐입니다."
          />
          <PrincipleRow
            emoji="🌱"
            title="중립과 투명"
            body="공신력 있는 공공기관 자료(농림축산식품부·동물보호관리시스템 등)와 동물약국 표시사항을 바탕으로 정보를 정리하고, 의료·법률 판단은 반드시 전문가와 상의하도록 안내합니다."
            last
          />
        </div>
      </section>

      {/* 케어테이커에게 전하는 말 */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 mb-3">
          <Hand size={14} style={{ color: "#C47E5A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main">케어테이커님께</h2>
        </div>
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF8DC 0%, #FFEFB6 100%)",
            border: "1px solid rgba(232,176,64,0.25)",
          }}
        >
          <p className="text-[13px] leading-[2] text-text-sub">
            처음 만난 아이의 사진 한 장, 한 줄 기록이
            그 동네의 또 다른 케어테이커에게는 큰 안심이 됩니다.
          </p>
          <p className="text-[13px] leading-[2] text-text-sub mt-3">
            너무 걱정되는 아이가 있다면 <b className="text-text-main">Private Circle</b>로
            믿는 이웃에게만 보이게 등록하셔도 돼요. 어떤 선택을 하시든,
            그 손은 도시공존이 끝까지 함께 지키겠습니다.
          </p>
          <p className="text-[13px] leading-[2] text-text-sub mt-3">
            의견·제안·불편한 점 무엇이든 메일 한 통이면 운영자에게 직접 닿습니다.
            오래 같이 가요. 🐾
          </p>
        </div>
      </section>

      {/* 연락처 / 제휴 */}
      <section className="px-5 mt-7">
        <div className="flex items-center gap-2 mb-3">
          <Coffee size={14} style={{ color: "#8B5A3C" }} />
          <h2 className="text-[14px] font-extrabold text-text-main">제휴·문의·차 한 잔</h2>
        </div>
        <div className="bg-white rounded-3xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] leading-[1.95] text-text-sub mb-4">
            언론·블로그 취재, 동물보호 단체 협업, 지자체·캠페인 제휴, 학교 프로젝트
            인터뷰 등 어떤 결의 이야기든 환영합니다. 답장은 운영자가 직접 드려요.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[도시공존] 안녕하세요")}`}
            className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[13px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 14px rgba(196,126,90,0.30)",
            }}
          >
            <Mail size={14} />
            <span>운영자에게 직접 메일 보내기</span>
          </a>
          <p className="text-[11px] text-text-light mt-3 text-center">
            {CONTACT_EMAIL}
          </p>
        </div>
      </section>

      {/* 푸터 링크 */}
      <section className="px-5 mt-7 text-center">
        <p className="text-[11px] text-text-light leading-relaxed">
          더 자세한 서비스 소개는{" "}
          <Link href="/about" className="underline" style={{ color: "#A8684A" }}>
            소개 페이지
          </Link>
          {" · "}이용약관·개인정보처리방침은{" "}
          <Link href="/terms" className="underline" style={{ color: "#A8684A" }}>
            약관
          </Link>
          {" · "}
          <Link href="/privacy" className="underline" style={{ color: "#A8684A" }}>
            처리방침
          </Link>
        </p>
      </section>
    </div>
  );
}

function SkillCard({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "linear-gradient(135deg, #FFF9F2 0%, #F4E8D8 100%)",
        border: "1px solid rgba(196,126,90,0.18)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: "#A8684A" }}>
        {icon}
        <p className="text-[12px] font-extrabold tracking-tight text-text-main">{title}</p>
      </div>
      <p className="text-[10.5px] text-text-sub leading-tight">{sub}</p>
    </div>
  );
}

function PrincipleRow({
  emoji,
  title,
  body,
  last,
}: {
  emoji: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "pb-3 mb-3 border-b"} style={last ? {} : { borderColor: "rgba(107,142,111,0.18)" }}>
      <div className="flex items-start gap-2.5">
        <span className="text-[18px] shrink-0 leading-none mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold text-text-main leading-snug tracking-tight">{title}</p>
          <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
