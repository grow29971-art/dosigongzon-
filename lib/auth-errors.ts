// ══════════════════════════════════════════
// OAuth / Auth 에러 코드 → 친절한 한국어 메시지
// ══════════════════════════════════════════

export type AuthErrorGuide = {
  title: string;
  body: string;
  tip?: string;     // 사용자 행동 가이드
  severity: "info" | "warn" | "danger";
};

export function explainAuthError(
  code: string | null | undefined,
  desc: string | null | undefined,
  provider?: string | null,
): AuthErrorGuide {
  const c = (code ?? "").toLowerCase();
  const d = (desc ?? "").toLowerCase();

  // ── 카카오 KOE 시리즈 ──
  if (c === "koe205" || d.includes("koe205") || d.includes("disallowed_useragent")) {
    return {
      title: "인앱 브라우저에서는 카카오 로그인이 차단돼요",
      body: "카카오톡/인스타/페이스북 등 앱 내부 브라우저에서는 보안 정책상 로그인이 불가해요.",
      tip: "주소를 복사해서 크롬이나 사파리에서 열어주세요.",
      severity: "warn",
    };
  }
  if (c === "koe101" || d.includes("koe101")) {
    return {
      title: "카카오 앱 설정 오류",
      body: "서비스 설정에 문제가 있어요. 관리자에게 문의해주세요.",
      tip: "이메일 로그인 또는 구글 로그인으로 우회 가능해요.",
      severity: "danger",
    };
  }
  if (c === "koe006" || d.includes("koe006")) {
    return {
      title: "카카오 Redirect URI 불일치",
      body: "카카오 콘솔에 이 도메인이 등록돼 있지 않아요.",
      tip: "관리자 이슈예요. 잠시 후 다시 시도해주세요.",
      severity: "danger",
    };
  }

  // ── 이메일 링크 만료 / 재사용 (비밀번호 재설정·매직링크) ──
  // access_denied보다 먼저 체크 — Supabase가 otp_expired도 access_denied로 감싸서 보냄
  if (c === "otp_expired" || d.includes("otp_expired") || d.includes("email link is invalid") || d.includes("has expired")) {
    return {
      title: "재설정 링크가 만료됐어요",
      body: "메일 링크는 받은 후 1시간 동안, 한 번만 사용할 수 있어요.",
      tip: "비밀번호 찾기에서 메일을 다시 받아주세요.",
      severity: "warn",
    };
  }

  // ── OAuth 표준 에러 ──
  if (c === "redirect_uri_mismatch" || d.includes("redirect_uri_mismatch")) {
    return {
      title: "로그인 경로 설정 오류",
      body: "OAuth 제공자에 등록된 주소와 실제 주소가 달라요.",
      tip: "관리자 이슈예요. 이메일 로그인을 이용해주세요.",
      severity: "danger",
    };
  }
  if (c === "access_denied" || d.includes("access_denied")) {
    return {
      title: "로그인이 취소됐어요",
      body: "약관 동의를 거절했거나 로그인 창을 닫으셨어요.",
      tip: "다시 시도해주세요.",
      severity: "info",
    };
  }
  if (c === "unauthorized_client") {
    return {
      title: "권한 설정 오류",
      body: "OAuth 앱 권한 설정에 문제가 있어요.",
      tip: "이메일 로그인을 이용해주세요.",
      severity: "danger",
    };
  }

  // ── Supabase / 세션 관련 ──
  if (c === "auth_failed" || c === "invalid_grant") {
    return {
      title: "세션 생성에 실패했어요",
      body: "쿠키나 로컬 저장소 접근이 차단돼 있을 수 있어요.",
      tip: "시크릿/프라이빗 모드를 끄거나, 광고차단 확장 프로그램을 잠시 꺼주세요.",
      severity: "warn",
    };
  }
  if (c === "server_error" || c === "temporarily_unavailable") {
    return {
      title: "잠시 연결이 불안정해요",
      body: "OAuth 서버가 일시적으로 느려요.",
      tip: "잠시 후 다시 시도해주세요.",
      severity: "info",
    };
  }
  if (d.includes("cookie") || d.includes("storage")) {
    return {
      title: "브라우저 저장소가 차단됐어요",
      body: "쿠키 또는 localStorage가 차단되면 로그인 상태 유지가 안 돼요.",
      tip: "시크릿 모드 해제 · 쿠키 허용 · 광고차단 OFF 를 시도해주세요.",
      severity: "warn",
    };
  }

  // ── 이메일/비밀번호 ──
  if (d.includes("email not confirmed") || d.includes("email_not_confirmed")) {
    return {
      title: "이메일 인증이 필요해요",
      body: "가입 시 받은 인증 메일을 확인해주세요.",
      tip: "메일이 안 왔다면 스팸함도 확인해보세요.",
      severity: "warn",
    };
  }
  if (d.includes("invalid login credentials")) {
    return {
      title: "이메일 또는 비밀번호가 달라요",
      body: "소셜로 가입한 계정이면 같은 이메일을 OAuth로 다시 로그인해주세요.",
      severity: "info",
    };
  }

  // ── 기본 ──
  return {
    title: "로그인 중 문제가 발생했어요",
    body: desc || "알 수 없는 오류가 발생했어요.",
    tip: provider === "kakao"
      ? "크롬/사파리에서 시도하거나 구글 로그인을 이용해주세요."
      : "잠시 후 다시 시도하거나 이메일 로그인을 이용해주세요.",
    severity: "warn",
  };
}
