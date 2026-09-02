# 외부 인터페이스 계약

이 서비스는 공개 개발자 API를 제공하지 않는다. 외부에서 이 시스템을 "호출하는" 소비자는 아래
넷이고, 각각이 기대하는 계약을 지켜야 한다.

## 1. Android TWA (Play 스토어 앱)

- 계약: TWA는 `https://dosigongzon.com`을 그대로 신뢰해 감싼다. **도메인 변경·주요 경로
  (`/`, `/map`, `/login`) 삭제는 스토어 앱을 깨뜨린다** — 경로를 없앨 땐 리다이렉트를 남길 것.
- `public/.well-known/assetlinks.json`이 앱 서명과 도메인을 연결한다 — 이 파일이 깨지면 TWA가
  주소창 붙은 브라우저로 강등된다.
- 앱 컨텐츠 갱신은 웹 배포만으로 충분(TWA 재빌드 불요).

## 2. Vercel Cron → `/api/cron/*`

- 호출 형식: `Authorization: Bearer <CRON_SECRET>` 헤더(또는 동등 검사)를 포함한 GET.
- 응답 계약: 성공 2xx / 실패는 실패 상태코드로 — **내부 실패를 200으로 감싸 반환하지 않는다**
  (과거 결행 은폐 사고의 원인). 크론 등록은 `vercel.json`.

## 3. 토스페이먼츠 (결제 — 오픈 준비 중)

- 결제 승인 플로우: 클라이언트 SDK 결제창 → success URL로 복귀 → 서버가 승인 API 호출 →
  주문 확정. 실패는 fail URL로 복귀.
- 웹훅: 결제 상태 변경 통지를 서버 라우트가 수신한다. **웹훅 시크릿 검증은 결제 오픈 D-day
  게이트 3종 중 하나** — 시크릿 없이 열지 않는다.
- 환불: 서버에서 토스 환불 API 호출 → 결과를 주문·환불 기록에 반영. 정책 판정은
  `lib/refund-policy.ts` 로직이 단일 소스.
- 현재는 테스트 키 상태이며 `PAYMENT_ENABLED` 게이트가 꺼져 있다 — 라이브 키 전환 전에 실결제
  경로를 켜지 않는다.

## 4. 푸시 구독 브라우저 (서비스워커)

- 발송 페이로드 계약(JSON): `{ "title": string, "body": string, "url": string }` —
  서비스워커(`public/sw.js`)가 이 형태를 파싱해 알림을 띄우고 클릭 시 `url`로 이동시킨다.
  필드를 바꾸면 이미 설치된 서비스워커들과 어긋난다(하위 호환 필수).
- 구독 등록: 클라이언트가 `POST /api/push/subscribe`에 PushSubscription JSON을 보낸다(로그인 필수).
- 죽은 구독: 발송 시 410/404를 받으면 서버가 해당 구독 행을 삭제한다.

## 공통 규약

- 인증이 필요한 API 라우트는 `Authorization: Bearer <supabase access token>` 헤더를 받는다.
  실패 응답은 `{ ok: false, error: string }` + 4xx/5xx, 성공은 `{ ok: true, ... }` 형태가 관례.
- 크롤러 대상 계약: 랜딩·지역 페이지는 JSON-LD(FAQ 등)를 SSR로 내보낸다. 비로그인 응답에
  정확 좌표가 실리지 않는 것이 SEO 페이지에도 동일하게 적용된다.
