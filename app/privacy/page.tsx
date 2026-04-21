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
            <li><b>선택 항목</b>: 프로필 사진, 활동 지역(동네 이름·반경), 마케팅 이메일 수신 동의 여부</li>
            <li><b>위치정보</b>: 길고양이 등록·지도 조회 시 기기의 GPS 좌표(동의 시). 유저 본인의 위치는 저장하지 않으며, 고양이 등록 시 입력된 좌표는 비로그인 유저에게는 동 단위로 근사화되어 표시됩니다.</li>
            <li><b>자동 수집</b>: 서비스 이용 기록, 접속 IP(해시 처리 후 방문자 중복 방지 목적으로만), 접속 시간, 기기·브라우저 정보</li>
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
          <h2 className="text-[15px] font-bold text-text-main mb-2">제5조 (위탁 및 국외 이전)</h2>
          <p className="mb-2">서비스는 다음 기업·기관에 개인정보 처리를 위탁하며, 아래 항목은 해외로 이전됩니다. 이전되는 정보는 서비스 제공에 필수적이며, 각 위탁사는 자체 개인정보 정책에 따라 안전하게 처리합니다.</p>

          <p className="text-[12px] font-bold text-text-sub mt-3 mb-1">가. 필수 인프라</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Supabase(Supabase Inc, 미국)</b> — 데이터베이스·인증·파일 저장소. 전송 항목: 수집하는 모든 서비스 데이터</li>
            <li><b>Vercel(Vercel Inc, 미국)</b> — 웹 서비스 호스팅·Analytics. 전송 항목: 접속 로그, 기기·브라우저 정보</li>
          </ul>

          <p className="text-[12px] font-bold text-text-sub mt-3 mb-1">나. 이메일 발송</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Resend(Resend Inc, 미국)</b> — 주간 이메일 다이제스트 발송(수신 동의 유저만). 전송 항목: 이메일 주소, 닉네임</li>
            <li><b>Supabase Auth 이메일</b> — 가입 인증·비밀번호 재설정 메일</li>
          </ul>

          <p className="text-[12px] font-bold text-text-sub mt-3 mb-1">다. 기능 제공 서비스</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Kakao(한국)</b> — 카카오 지도 SDK, 장소 검색 API, 카카오톡 공유 SDK. 전송 항목: 브라우저에서 지도 조회 시의 좌표·검색어</li>
            <li><b>Google(Gemini API, 미국)</b> — AI 집사 챗봇. 전송 항목: 유저가 입력한 질문 텍스트(대화 내용은 서비스 서버에 저장되지 않음)</li>
            <li><b>Cloudflare(Cloudflare Inc, 미국)</b> — Turnstile 봇 방어. 전송 항목: 브라우저 토큰</li>
            <li><b>OpenWeatherMap(영국)</b> — 날씨 정보. 전송 항목: 좌표(위도·경도)</li>
            <li><b>ip-api.com(독일)</b> — IP 기반 대략적 위치 추정(GPS 거부 시 대체). 전송 항목: 클라이언트 IP</li>
            <li><b>공공데이터포털(LOCALDATA, 한국)</b> — 동물약국 공공데이터 조회</li>
          </ul>

          <p className="text-[11px] text-text-light mt-3">
            국외 이전을 원하지 않는 경우 회원 탈퇴를 통해 중단할 수 있으나, 이 경우 서비스 이용이 제한됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제5조의2 (위치정보 수집·이용)</h2>
          <p className="mb-2">
            서비스는 길고양이 지도·동네 고양이 표시를 위해 유저의 동의를 받아 기기 GPS 좌표를 일시적으로 사용합니다.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>목적: 현재 위치 지도 중심 이동, 근거리 고양이 조회</li>
            <li>수집 방식: 브라우저 Geolocation API — 이용자 동의 시에만</li>
            <li>저장 여부: <b>유저 본인의 위치는 서버에 저장되지 않습니다.</b> 고양이 등록 시 입력된 좌표만 저장되며, 비로그인 유저에게는 동 단위 근사치로만 공개됩니다.</li>
            <li>동의 철회: 브라우저/OS 설정에서 위치 권한을 거부하시면 서비스에 좌표가 전달되지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제5조의3 (마케팅 정보 수신 동의)</h2>
          <p className="mb-2">
            이메일 다이제스트·재참여 푸시 등 광고성 정보는 <b>사전 동의(옵트인)</b> 후에만 발송됩니다.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>동의 시점: 회원가입 시 선택 체크박스, 또는 마이페이지 "주간 이메일 받기" 토글</li>
            <li>동의 철회: 마이페이지 토글 OFF, 또는 이메일 하단 수신 설정 링크. 즉시 반영되며 다음 발송부터 중단</li>
            <li>수신 동의와 무관하게 가입 인증·비밀번호 재설정 등 서비스 필수 메일은 계속 발송됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제6조 (이용자의 권리 및 행사 방법)</h2>
          <ul className="list-disc pl-4 space-y-1">
            <li>이용자는 언제든지 자신의 개인정보를 <b>조회·수정·삭제</b>할 수 있습니다.</li>
            <li>마이페이지에서 프로필·활동 기록을 직접 수정할 수 있으며, 회원 탈퇴를 통해 전체 데이터 삭제를 요청할 수 있습니다.</li>
            <li>별도 조회·정정·삭제·처리정지 요청은 제10조의 연락처로 접수 시 <b>10일 이내</b> 처리 후 결과를 통지합니다. 불가피한 경우 사유와 예정 처리일을 안내합니다.</li>
            <li>처리 결과에 이의가 있는 경우 통지일로부터 <b>30일 이내</b>에 이의를 제기할 수 있습니다.</li>
            <li>푸시 알림은 브라우저/OS 설정에서, 이메일 수신은 마이페이지 "주간 이메일 받기" 토글 또는 메일 하단 "수신 거부" 링크로 즉시 해제할 수 있습니다.</li>
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
          <h2 className="text-[15px] font-bold text-text-main mb-2">제10조 (개인정보 보호책임자 및 문의)</h2>
          <p className="mb-2">
            본 서비스는 개인정보 처리에 관한 업무를 총괄하여 처리하는 책임자를 아래와 같이 지정하고 있습니다.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>개인정보 보호책임자</b>: 김성우 (운영자)</li>
            <li><b>이메일</b>: grow29971@gmail.com</li>
            <li><b>서비스 내 접수</b>: 마이페이지 → 문의하기</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-bold text-text-main mb-2">제11조 (권익침해 구제방법)</h2>
          <p className="mb-2">
            개인정보 침해로 인한 피해 구제·상담은 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>개인정보 분쟁조정위원회: <b>1833-6972</b> (www.kopico.go.kr)</li>
            <li>개인정보침해신고센터: <b>118</b> (privacy.kisa.or.kr)</li>
            <li>대검찰청 사이버수사과: <b>1301</b> (spo.go.kr)</li>
            <li>경찰청 사이버수사국: <b>182</b> (ecrm.police.go.kr)</li>
          </ul>
        </section>

        <p className="text-[11px] text-text-light pt-4">시행일: 2026년 4월 21일</p>
      </div>
    </div>
  );
}
