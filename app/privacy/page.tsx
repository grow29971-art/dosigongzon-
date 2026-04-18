import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "도시공존 개인정보처리방침 — 수집·이용 목적, 보관 기간, 제3자 제공 등.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="px-5 pt-14 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/signup"
          className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-text-sub" />
        </Link>
        <h1 className="text-[20px] font-extrabold text-text-main">개인정보처리방침</h1>
      </div>

      <div className="space-y-6 text-[13px] text-text-sub leading-relaxed">
        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제1조 (수집하는 개인정보)</h2>
          <p className="mb-2">서비스는 회원가입 및 서비스 제공을 위해 다음 정보를 수집합니다.</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>필수 항목</b>: 이메일, 닉네임, 비밀번호(암호화 저장)</li>
            <li><b>소셜 로그인 시</b>: 이메일, 프로필 이름, 프로필 사진 URL (해당 플랫폼 제공 범위)</li>
            <li><b>자동 수집</b>: 서비스 이용 기록, 접속 시간, 기기 정보</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제2조 (수집 목적)</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>회원 식별 및 서비스 제공</li>
            <li>커뮤니티 활동 관리 (게시글, 댓글, 쪽지)</li>
            <li>고양이 돌봄 기록 관리</li>
            <li>푸시 알림 전송 (동의 시)</li>
            <li>부정 이용 방지 및 서비스 개선</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제3조 (보유 및 이용 기간)</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>회원 탈퇴 시 즉시 파기합니다.</li>
            <li>단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
            <li>부정 이용 기록: 1년</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제4조 (제3자 제공)</h2>
          <p>
            서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 법령에 의한 요청이 있는 경우 또는 이용자가 동의한 경우에는 예외로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제5조 (위탁)</h2>
          <p className="mb-2">서비스는 다음 기업·기관에 개인정보 처리를 위탁합니다.</p>
          <p className="text-[12px] font-bold text-text-sub mt-2 mb-1">가. 필수 인프라</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Supabase(Supabase Inc)</b>: 데이터베이스, 인증, 파일 저장소</li>
            <li><b>Vercel(Vercel Inc)</b>: 웹 서비스 호스팅</li>
          </ul>
          <p className="text-[12px] font-bold text-text-sub mt-2 mb-1">나. 기능 제공 서비스</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Kakao(카카오)</b>: 지도 서비스 및 병원·약국 검색 API</li>
            <li><b>Google(Gemini API)</b>: AI 챗봇 상담</li>
            <li><b>Cloudflare</b>: 봇 방어(Turnstile)</li>
            <li><b>OpenWeatherMap</b>: 날씨 정보 제공</li>
            <li><b>공공데이터포털(LOCALDATA)</b>: 동물약국 공공데이터 조회</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제6조 (이용자의 권리)</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>이용자는 언제든지 자신의 개인정보를 조회, 수정할 수 있습니다.</li>
            <li>회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.</li>
            <li>푸시 알림은 브라우저 설정에서 직접 해제할 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제7조 (보안)</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>비밀번호는 암호화되어 저장되며, 관리자도 확인할 수 없습니다.</li>
            <li>SSL/TLS 암호화 통신을 적용합니다.</li>
            <li>Row Level Security(RLS) 정책으로 데이터 접근을 제한합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제8조 (쿠키)</h2>
          <p>
            서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다.
            브라우저 설정에서 쿠키를 차단할 수 있으나, 이 경우 일부 기능이 제한될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제9조 (방침 변경)</h2>
          <p>
            본 방침은 필요 시 변경될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제10조 (문의)</h2>
          <p>
            개인정보 관련 문의는 서비스 내 신고/건의 기능 또는 관리자에게 연락해주세요.
          </p>
        </section>

        <p className="text-[11px] text-text-light pt-4">시행일: 2026년 4월 15일</p>
      </div>
    </div>
  );
}
