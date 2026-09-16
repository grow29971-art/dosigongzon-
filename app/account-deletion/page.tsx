import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trash2, Mail, ShieldAlert, Cat, ChevronRight, Clock } from "lucide-react";

const SITE_URL = "https://dosigongzon.com";

export const metadata: Metadata = {
  title: "계정 삭제 안내 | 도시공존",
  description: "도시공존 계정 및 데이터 삭제 방법 안내",
  alternates: { canonical: `${SITE_URL}/account-deletion` },
  openGraph: {
    title: "계정 삭제 안내 | 도시공존",
    description: "도시공존 계정 및 데이터 삭제 방법을 안내합니다.",
    url: `${SITE_URL}/account-deletion`,
  },
  robots: { index: true, follow: true },
};

const STEP_NUM: React.CSSProperties = {
  background: "var(--color-gray-100)",
  color: "var(--color-text-sub)",
  borderRadius: "var(--radius-square)",
};

export default function AccountDeletionPage() {
  return (
    <div className="pb-16" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-gray-100)" }}
          aria-label="홈으로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
      </div>

      <article className="max-w-2xl mx-auto px-4 mt-2">
        {/* 타이틀 */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Cat size={16} className="text-text-light" />
            <span className="text-[13px] font-semibold text-text-sub">도시공존</span>
          </div>
          <h1 className="text-[24px] font-bold text-text-main tracking-tight leading-tight">
            계정 삭제 안내
          </h1>
          <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
            도시공존(City Coexistence) 앱·웹사이트의 계정과 데이터를 삭제하시려면
            아래 방법 중 하나를 따라주세요. 삭제 요청은 본인 확인 후 즉시 처리됩니다.
          </p>
        </header>

        {/* 방법 1: 앱·웹에서 직접 삭제 */}
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={18} className="text-text-sub shrink-0" />
            <h2 className="text-[17px] font-bold text-text-main">
              방법 1. 앱·웹에서 직접 삭제 (권장)
            </h2>
          </div>

          <ol className="mt-4">
            <li className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-[11px] font-semibold" style={STEP_NUM}>
                1
              </span>
              <span className="text-[15px] text-text-main leading-relaxed">
                <Link href="/login" className="font-bold underline" style={{ color: "var(--color-primary)" }}>로그인</Link>
                {" "}후 우측 하단{" "}
                <strong>마이</strong>{" "}탭 진입
              </span>
            </li>
            <li className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-[11px] font-semibold" style={STEP_NUM}>
                2
              </span>
              <span className="text-[15px] text-text-main leading-relaxed">
                페이지 맨 아래로 스크롤 → <strong>계정 삭제</strong> 버튼 탭
              </span>
            </li>
            <li className="flex gap-3 py-3">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-[11px] font-semibold" style={STEP_NUM}>
                3
              </span>
              <span className="text-[15px] text-text-main leading-relaxed">
                확인 안내에 따라 진행 — 즉시 처리됩니다
              </span>
            </li>
          </ol>

          <Link
            href="/mypage"
            className="mt-3 flex items-center justify-between w-full px-4 py-3 press"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
          >
            <span className="text-[13px] font-bold text-white">
              마이페이지로 이동
            </span>
            <ChevronRight size={16} className="text-white" />
          </Link>
        </section>

        {/* 방법 2: 이메일로 요청 */}
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Mail size={18} className="text-text-sub shrink-0" />
            <h2 className="text-[17px] font-bold text-text-main">
              방법 2. 이메일로 요청
            </h2>
          </div>
          <p className="text-[13px] text-text-sub leading-relaxed mb-3">
            앱에 접속할 수 없거나 직접 삭제가 어려운 경우, 아래 메일로
            <strong className="text-text-main">{" "}가입 시 사용한 이메일 주소{" "}</strong>
            와 함께 "계정 삭제 요청"을 보내주시면 본인 확인 후 처리해드립니다.
          </p>
          <a
            href="mailto:grow29971@gmail.com?subject=%5B%EB%8F%84%EC%8B%9C%EA%B3%B5%EC%A1%B4%5D%20%EA%B3%84%EC%A0%95%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD&body=%EA%B0%80%EC%9E%85%20%EC%9D%B4%EB%A9%94%EC%9D%BC%3A%20%0A%EC%9A%94%EC%B2%AD%20%EC%82%AC%EC%9C%A0(%EC%84%A0%ED%83%9D)%3A%20"
            className="flex items-center justify-between w-full px-4 py-3 press"
            style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
          >
            <div>
              <p className="text-[13px] font-bold text-text-main">
                grow29971@gmail.com
              </p>
              <p className="text-[11px] text-text-sub mt-0.5">
                평일 1~3영업일 내 처리
              </p>
            </div>
            <ChevronRight size={16} style={{ color: "var(--color-text-muted)" }} />
          </a>
        </section>

        {/* 삭제되는 데이터 */}
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} style={{ color: "var(--color-error)" }} />
            <h2 className="text-[15px] font-bold text-text-main">
              삭제되는 데이터
            </h2>
          </div>
          <ul className="space-y-2 text-[13px] leading-relaxed text-text-sub">
            <li>· 계정 정보 (이메일, 닉네임, 프로필 사진)</li>
            <li>· 등록한 길고양이 정보 및 사진</li>
            <li>· 작성한 게시글, 댓글, 돌봄다이어리</li>
            <li>· 주고받은 1:1 쪽지</li>
            <li>· 활동 지역 설정, 좋아요·팔로우 관계</li>
            <li>· 차단·신고 기록</li>
            <li>· 푸시 알림 구독 정보</li>
          </ul>
        </section>

        {/* 보존되는 데이터 */}
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-text-sub" />
            <h2 className="text-[15px] font-bold text-text-main">
              일부 보존되는 데이터 (법령상 의무)
            </h2>
          </div>
          <ul className="space-y-2 text-[13px] leading-relaxed text-text-sub">
            <li>
              · <strong>로그인 기록 / 접속 IP</strong> — <strong>3개월</strong>{" "}
              (통신비밀보호법)
            </li>
            <li>
              · <strong>신고 처리 기록</strong> — <strong>3년</strong>{" "}
              (전자상거래법, 신고 대응을 위한 최소 보관)
            </li>
            <li>
              · <strong>익명화된 통계 데이터</strong> — 개인 식별 불가 형태로 무기한 보존 가능
            </li>
          </ul>
          <p className="text-[11px] mt-3 leading-relaxed text-text-sub">
            보존 기간이 끝난 데이터는 자동으로 삭제됩니다.
          </p>
        </section>

        {/* 안내 */}
        <p className="text-[13px] text-text-light leading-relaxed text-center mt-6 mb-4 px-2">
          삭제된 데이터는 복구할 수 없습니다.
          <br />
          처리 관련 문의: <a href="mailto:grow29971@gmail.com" className="underline">grow29971@gmail.com</a>
        </p>

        {/* 약관/정책 링크 */}
        <div className="flex justify-center gap-4 text-[11px] text-text-sub mt-4">
          <Link href="/privacy" className="underline">개인정보처리방침</Link>
          <Link href="/terms" className="underline">이용약관</Link>
        </div>
      </article>
    </div>
  );
}
