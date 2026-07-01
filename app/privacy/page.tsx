export const metadata = {
  title: '개인정보 처리방침 | 도시공존',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>개인정보 처리방침</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>최종 수정일: 2026년 7월 1일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. 수집하는 개인정보 항목</h2>
        <p>도시공존(이하 "서비스")은 서비스 제공을 위해 다음과 같은 정보를 수집합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>이메일 주소 (회원가입 시)</li>
          <li>닉네임 및 프로필 사진 (선택)</li>
          <li>위치 정보 (지도 기능 사용 시, 앱 사용 중에만 수집)</li>
          <li>기기 식별 정보 (푸시 알림 발송용 FCM 토큰)</li>
          <li>서비스 이용 기록 (게시글, 댓글, 고양이 등록 내역)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. 개인정보 수집 및 이용 목적</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 식별 및 서비스 제공</li>
          <li>길고양이 돌봄 정보 공유 커뮤니티 운영</li>
          <li>푸시 알림 발송</li>
          <li>부정 이용 방지 및 서비스 개선</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. 개인정보 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다. 단, 관계 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. 개인정보 제3자 제공</h2>
        <p>서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 이용자가 직접 동의한 경우 또는 법령에 따라 요구되는 경우는 예외로 합니다.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. 개인정보 처리 위탁</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Supabase Inc. — 데이터베이스 및 인증 서비스</li>
          <li>Google Firebase — 푸시 알림(FCM)</li>
          <li>Vercel Inc. — 서버 호스팅</li>
          <li>Cloudflare Inc. — 봇 방어(Turnstile)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>6. 이용자의 권리</h2>
        <p>이용자는 언제든지 자신의 개인정보를 조회·수정하거나 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다. 문의는 아래 이메일로 연락해 주세요.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>7. 개인정보 보호책임자</h2>
        <p>이메일: <a href="mailto:grow29971@gmail.com" style={{ color: '#C47E5A' }}>grow29971@gmail.com</a></p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>8. 개인정보 처리방침 변경</h2>
        <p>본 방침은 법령 및 서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.</p>
      </section>
    </main>
  );
}
