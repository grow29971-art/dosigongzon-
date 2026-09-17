# city-ios/ — iOS 앱 (WKWebView 셸)

dosigongzon.com을 WKWebView로 감싼 셸. UA에 `PWAShell`을 붙이고 `?ios=1`로 진입해 웹이 iOS 앱임을
안다. 번들 `kr.dosigongzon.app`, 팀 `V63FY2Y4AT`, App Store Connect 앱 ID 6786105879.

## 빌드·업로드 — Mac 없이

이 프로젝트를 만지는 PC는 Windows다. 빌드는 GitHub Actions `ios-release.yml`(macOS 러너)이 한다:
Actions → ios-release → Run workflow → 버전 입력 → `upload` 체크. 빌드 번호는 run_number.
서명은 **수동**(자동 서명은 기기 0대 팀에서 개발용 프로파일을 못 만들어 실패, 2026-09-17 실측):
배포 인증서 `.p12` + App Store 프로파일 "dosigongzon AppStore GH"를 Secrets에서 임시 키체인으로.
인증서 만료 2027-09-17 — 갱신은 ASC API로 새 인증서·프로파일 생성 후 Secrets 3종 교체
(`IOS_DIST_P12_B64`·`IOS_DIST_P12_PASSWORD`·`IOS_PROFILE_B64`). 원본 백업은 사장님 Desktop/애플앱키/.

## Apple 로그인 — 반드시 네이티브

WKWebView 안에서 Apple OAuth 리다이렉트를 돌리면 무한 로딩(App Store 반려 2.1(a), 2026-07-05).
`ViewController.swift`의 ASAuthorizationController → `window.__appleSignInSuccess(token, nonce)` →
웹 `lib/native-apple-signin.ts`가 `signInWithIdToken` → `/api/auth/callback?native=1`.
Supabase Apple 제공자 클라이언트 ID에 번들 ID `kr.dosigongzon.app`이 들어 있어야 토큰이 인정된다
(웹용 `kr.dosigongzon.app.siwa`와 쉼표 병기). 웹 로그인/가입 페이지의 브릿지 분기를 지우면 재발한다
(7/6 카드 커밋이 한 번 지웠었다).

## 심사 관련

- 반려 이력: 5.1.1(ii) 권한 문구, 5.1.2(i) 추적(→ PWAShell에서 Meta Pixel 비활성·쿠키 배너 자동 거부),
  2.1(a) Apple 로그인 무한 로딩(→ 네이티브 전환).
- 심사관은 iPad에서도 본다(TARGETED_DEVICE_FAMILY 1,2). 레이아웃은 웹 반응형에 의존.
- 위치 권한 문구는 Info.plist에 있으나 웹이 GPS를 켜지 않는다(decisions/0001). 문구는 유지.
