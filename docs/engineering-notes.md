# 실전 지식 (모르면 당하는 것들)

## 이 머신(grow2 PC)의 함정

- **`npm run build` 로컬 실행 불가.** Application Control 정책이 `@next/swc-win32-x64-msvc`
  네이티브 바이너리를 차단해 "native bindings not available"로 죽는다. 코드 문제가 아니다.
  → 검증은 `npx tsc --noEmit` + `npx eslint <파일>` + 배포 후 프로덕션 확인으로 대체.
- **Vercel CLI가 그냥은 죽는다.** PC 이름이 한글이라 CLI가 호스트명을 HTTP 헤더에 넣다가
  `Cannot convert argument to a ByteString` 오류. `os.hostname`을 ASCII로 바꿔치기하는 프리로드
  (`box/vercel-hostpatch.cjs`)를 `node -r`로 물려야 작동한다. → 평소엔 CLI 불필요: `git push`가
  곧 배포다.
- **gh CLI 미설치.** GitHub API는 익명 curl로 호출한다(repo가 public이라 됨). 배포 성공 확인:
  `curl -s https://api.github.com/repos/grow29971-art/dosigongzon-/commits/<sha>/status` →
  `state: success`. gh 명령을 조건으로 거는 폴링 루프는 영원히 헛돈다(실제 사고 있었음).
- **`.env.local` 값 끝에 리터럴 `\n` 문자열이 붙은 항목이 있다.** 파싱해 쓸 때 따옴표·`\n` 제거
  없이 그대로 쓰면 URL 파싱 실패·401이 난다.
- PowerShell 5.1 기준: `&&`/`||` 없음, 커밋 메시지의 큰따옴표가 인자 분리를 깨뜨린다 —
  멀티라인 커밋은 `@'...'@` here-string, 메시지 안 따옴표는 피한다.

## Supabase 함정

- **anon으로 base `cats`에 임의 컬럼 필터를 걸면 42501(permission denied).** anon은 컬럼 단위
  그랜트만 있다(좌표 잠금 계약). 증상: 서비스 키론 되는 쿼리가 프로덕션 SSR에서만 빈 결과.
  → 비로그인 조회는 `cats_public_map` 뷰로(공개·비숨김·비추모 필터 내장).
- **`is_user_not_suspended`는 인자 필수.** RLS 정책에서 무인자로 부르면 42883으로 그 정책을 쓰는
  모든 쿼리가 죽는다. 올바른 호출: `public.is_user_not_suspended(auth.uid())`.
- **unique 인덱스 + 트리거 조합 주의.** `profiles_nickname_unique_idx(lower(nickname))` 추가 후
  가입 트리거가 카카오 실명을 그대로 insert하다 충돌 → auth.users까지 롤백 → 같은 이름 유저는
  영구 가입 실패(2026-09-02 실사고, 접미사 회피로 수정). 트리거가 넣는 값에 unique 제약이 걸리면
  트리거 안에서 충돌 회피를 구현할 것.
- **SQL Editor 실행 시 Chrome 번역 OFF.** 번역이 SQL 텍스트를 바꿔 실행을 깨뜨린 전력이 있어
  모든 마이그레이션 파일 머리에 경고가 박혀 있다.
- **관리자 화면에서 클라이언트 세션으로 count하면 잠긴 테이블은 반쪽 숫자가 나온다.** profiles
  잠금(self+admin) 이후 관리자 대시보드의 가입자·오늘 가입이 0~1로 나오던 실사고(2026-09-02 수정).
  전수 통계는 서버 라우트에서 admin 검증 후 service 키로 센다(`/api/admin/stats` 패턴). "오늘"
  기준은 KST 자정으로 계산할 것 — 서버 로컬 자정으로 세면 9시간 어긋난다.
- **"실행 대기"라고 적힌 문서를 믿지 말 것.** 실제로 실행됐는지는 REST 프로브로 실측한다
  (과거 대기 5건이 전부 이미 실행돼 있었음). 프로브는 service 키와 anon 키 **이중**으로 —
  권한 차이가 곧 버그의 원인일 때가 많다. anon 401 프로브는 PowerShell IWR 오탐이 있으니
  curl/node fetch로.

## 인증·플랫폼 함정

- 카카오톡 등 인앱 브라우저는 OAuth를 차단한다(정책). 카카오 로그인만 예외적으로 동작 —
  인앱 감지는 `lib/in-app-browser.ts`.
- iOS 사파리(홈 화면 미설치)는 Notification API 자체가 없다 → 웹푸시 불가. welcome 플로우가
  이 경우 알림 스텝 대신 "홈 화면에 추가" 안내를 보여준다. iOS 푸시 지표가 낮은 건 구조다.
- PKCE "code verifier not found" 로그인 실패는 브라우저 전환·저장소 유실 유형 — 같은 브라우저에서
  재시도하면 성공한다. 코드 수정 대상이 아니라 재시도 UX 문제.
- 홈 첫 화면 분기는 `getSession()`(쿠키 파싱만)을 쓴다 — `getUser()`로 바꾸면 auth 서버 왕복
  때문에 홈 TTFB가 1.9s까지 늘어진다(실측). 셸 선택 용도로는 낮은 검증 강도가 의도.

## 외부 서비스 쿼터·특성

- Gemini 무료 쿼터 일 20회. 2.0 모델은 쿼터 0이라 죽는다 — 2.5 계열 사용.
- Meta CAPI는 `META_PIXEL_ACCESS_TOKEN` 미설정 시 조용히 스킵(에러 아님). 쿠키 동의
  (`dosigongzon_cookie_consent=accepted`)가 없으면 발사하지 않는 게 정상 동작.
- Telegram 통지도 토큰 미설정 시 silent skip. "알림이 안 온다" 디버깅 전에 env부터.
- web-push 발송 중 410/404 응답은 죽은 구독 — 그 자리에서 구독 행을 삭제하는 게 관례.

## 검증 절차 체크리스트

- 코드 변경: `npx tsc --noEmit` → 커밋(1변경) → push → GitHub status API로 success 확인 →
  프로덕션 URL을 curl로 실측(문구·상태코드) → 그 다음에 완료 보고.
- DB 변경: box/에 SQL 파일(롤백 주석 포함) → 사장님 실행 → REST 프로브(service+anon)로 반영 확인.
- 지표 주장: 문서·기억이 아니라 당일 REST 프로브 실측값으로만 말한다.

## Next.js 16 주의

- 학습 데이터의 Next.js와 API·관례가 다르다. 코드 작성 전 `node_modules/next/dist/docs/`의 해당
  가이드를 먼저 읽고, deprecation 경고를 따른다.
