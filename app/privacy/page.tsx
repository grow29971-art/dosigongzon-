export const metadata = {
  title: '개인정보 처리방침 | 도시공존',
};

// 2026-07-12 전면 개정 — 국외 이전 고지(개보법 §28-8), AI 챗봇·결제·행태정보 추가,
// 실제 처리 현황과 불일치 항목 수정 (FCM→자체 웹푸시, GPS 측위 현재 미수집)
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>개인정보 처리방침</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>최종 수정일: 2026년 7월 12일</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>1. 수집하는 개인정보 항목</h2>
        <p>도시공존(이하 "서비스")은 서비스 제공을 위해 다음과 같은 정보를 수집합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>이메일 주소 (회원가입 시)</li>
          <li>닉네임 및 프로필 사진 (선택)</li>
          <li>이용자가 직접 입력하는 활동 지역 정보 (동 단위, 선택)</li>
          <li>웹푸시 구독 정보 (알림 수신 동의 시, 브라우저 푸시 엔드포인트)</li>
          <li>서비스 이용 기록 (게시글, 댓글, 고양이 등록 내역)</li>
          <li>쇼핑몰 이용 시: 주문 내역, 수령인 이름·연락처·배송지 주소</li>
          <li>AI 집사 이용 시: 이용자가 입력한 대화 내용</li>
        </ul>
        <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
          ※ 단말기 GPS를 이용한 실시간 위치 측위는 현재 수집하지 않습니다. 지도에 표시되는
          고양이 위치는 이용자가 지도에서 직접 지정한 좌표이며, 개인의 위치를 나타내지 않습니다.
          사진 업로드 시 위치 메타데이터(EXIF GPS)는 자동으로 제거됩니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>2. 개인정보 수집 및 이용 목적</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>회원 식별 및 서비스 제공</li>
          <li>길고양이 돌봄 정보 공유 커뮤니티 운영</li>
          <li>쇼핑몰 주문 처리, 결제, 배송 및 환불</li>
          <li>AI 챗봇 응답 생성</li>
          <li>푸시 알림·이메일 소식 발송 (수신 동의자에 한함)</li>
          <li>부정 이용 방지 및 서비스 개선</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>3. 개인정보 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다. 단, 관계 법령에 따라 다음 정보는 명시된 기간 동안 보관합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>계약 또는 청약철회, 대금 결제 및 재화 공급 기록 — 5년 (전자상거래법)</li>
          <li>소비자 불만 또는 분쟁 처리 기록 — 3년 (전자상거래법)</li>
          <li>서비스 접속 기록 — 3개월 (통신비밀보호법)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>4. 개인정보 제3자 제공</h2>
        <p>서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>이용자가 직접 동의한 경우 또는 법령에 따라 요구되는 경우</li>
          <li>쇼핑몰 결제 처리를 위해 토스페이먼츠(주)에 주문번호·결제금액을 제공하는 경우
            (카드번호 등 결제수단 정보는 토스페이먼츠가 직접 수집하며 서비스는 보관하지 않습니다)</li>
          <li>상품 배송을 위해 택배사에 수령인 이름·연락처·주소를 제공하는 경우</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>5. 개인정보의 국외 이전 (처리 위탁)</h2>
        <p>
          서비스는 안정적인 운영을 위해 아래와 같이 개인정보 처리를 국외 사업자에 위탁하고 있습니다.
          이전되는 정보는 암호화된 통신(TLS)으로 전송·보관되며, 위탁 목적 달성 시 또는 회원 탈퇴 시 파기됩니다.
          이용자는 국외 이전을 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><b>Supabase Inc.</b> (미국) — 데이터베이스·인증·파일 저장 / 계정 정보 및 서비스 이용 기록 전반 / 서비스 이용 기간 동안</li>
          <li><b>Vercel Inc.</b> (미국) — 서버 호스팅 및 접속 통계 / 접속 기록 / 서비스 이용 시점</li>
          <li><b>Cloudflare, Inc.</b> (미국) — 가입 시 봇 방어(Turnstile) / 접속 정보 / 검증 시점</li>
          <li><b>Google LLC</b> (미국) — AI 챗봇(Gemini) 응답 생성 / 이용자가 챗봇에 입력한 대화 내용 / 응답 생성 시점</li>
          <li><b>Functional Software, Inc. (Sentry)</b> (미국) — 오류 모니터링 / 오류 발생 시점의 접속 정보 / 90일</li>
          <li><b>Meta Platforms, Inc.</b> (미국) — 광고 성과 측정(픽셀, 쿠키 동의 시에만) / 행태정보 / Meta 정책에 따름</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>6. 행태정보 수집 및 맞춤형 광고</h2>
        <p>
          서비스는 광고 성과 측정을 위해 Meta 픽셀을 사용할 수 있습니다. 이는 첫 방문 시
          쿠키 동의 배너에서 <b>동의한 경우에만</b> 작동하며, 거부 시 어떠한 행태정보도
          수집되지 않습니다. 동의 후에도 브라우저 쿠키 삭제로 언제든 초기화할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>7. 이용자의 권리</h2>
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·수정하거나 회원 탈퇴(마이페이지 또는{' '}
          <a href="/account-deletion" style={{ color: 'var(--color-primary)' }}>계정 삭제 안내</a>)를
          통해 개인정보 삭제를 요청할 수 있습니다. 푸시·이메일 수신은 마이페이지에서 각각
          끄고 켤 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>8. 개인정보 보호책임자</h2>
        <p>이메일: <a href="mailto:grow29971@gmail.com" style={{ color: 'var(--color-primary)' }}>grow29971@gmail.com</a></p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>9. 개인정보 처리방침 변경</h2>
        <p>본 방침은 법령 및 서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.</p>
      </section>
    </main>
  );
}
