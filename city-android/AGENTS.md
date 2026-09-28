# city-android/ — Android TWA

## 범위

Bubblewrap 기반 TWA(Trusted Web Activity) 빌드 유닛. dosigongzon.com을 그대로 감싸 Play 스토어에
출시돼 있다. **WebView 앱이 아니다** — 웹 코드를 여기로 복사하거나 네이티브 화면을 만들지 않는다.

## 언제 이 폴더를 건드리나

- 앱 이름·아이콘·스플래시·테마색·시작 URL을 바꿀 때만(`twa-manifest.json` → 재빌드).
- 웹 기능 변경은 이 폴더와 무관하다 — 웹 배포만으로 앱 내용이 갱신된다.

## 불변 규칙

- 시작 도메인은 dosigongzon.com. 도메인·서명 연결은 웹 쪽 `public/.well-known/assetlinks.json`과
  쌍이다 — 한쪽만 바꾸면 앱이 브라우저 강등된다.
- 서명 키스토어는 이 저장소에 없다. 구 업로드 키는 비밀번호 분실로 2026-09-28 Play Console에 **업로드 키 재설정 요청**
  (사유: 비밀번호 잊어버림). 새 업로드 키 = `C:\Users\grow2\Documents\city-upload-key-20260928\upload.keystore`
  (alias `upload`, 비밀번호는 같은 폴더 PASSWORD.txt, SHA-256 55:97:AB:7C:…:AF:03). 승인 전까지는 새 키로 서명한 AAB 업로드 불가.
  앱 서명 키(Play 보관)는 그대로라 assetlinks.json 변경 불필요.
  **키스토어 없이 재서명·키 교체를 시도하지 않는다** — 같은 앱으로의 업데이트가 영구 불가가 된다.
- 빌드 산출물(aab/apk)이 저장소에 커밋돼 있는 것은 과거 출시본 보존 목적 — 덮어쓰지 말고 새
  파일명으로 추가한다.

## 참고

- 스크린샷·그래픽 생성 스크립트(capture-*.mjs 등)는 스토어 등록 이미지용 일회성 도구다.
- iOS는 이 폴더 소관이 아니다(city-ios는 보류 중, 작업 흔적은 별도 브랜치).
