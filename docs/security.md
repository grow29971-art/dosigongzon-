# 보안 정책

## 보호 대상 (우선순위 순)

1. **고양이 위치** — 노출되면 학대 표적이 된다. 이 프로젝트에서 가장 무거운 자산.
2. **이용자 신원·활동 정보** — 프로필, 케어 활동(누가 어디를 돌보는지), 학대 제보 내용.
3. **결제·포인트 무결성** — 금액·적립·환불 조작 방지.
4. **인증 자격증명·서비스 키**.

## 위치 비공개 계약 (전 기능 공통, 완화 금지)

- **실좌표는 시스템 어디에도 존재하지 않는다.** 등록·수정 시 **브라우저에서** ±444m 랜덤 오프셋을
  적용한 뒤에야 전송된다(`applyLocationOffset` — createCat·updateCat 공통 단일 방어선). 실좌표는
  네트워크로도 나가지 않고 DB에도 저장되지 않는다 — 이것이 위치정보법 무신고 구성의 근거다.
  등록·수정 경로를 새로 만들 때 이 오프셋을 우회하면 계약 전체가 깨진다(과거 수정 경로 누락 회귀
  있었음).
- 로그인 유저에게는 DB 저장 좌표(=이미 오프셋된 값)를 그대로 준다. **비로그인에게는 여기에
  결정적 퍼징 500m를 추가**(cat.id 시드)해 합산 최대 ±900m — 동 안 어디인지 식별 불가 수준.
- 로그인/비로그인 응답 좌표가 다르므로 **좌표가 담긴 응답을 익명 공유 캐시에 넣지 않는다**
  (캐시가 섞이면 비로그인이 로그인용 좌표를 받는다).
- 비로그인 지도의 데이터 소스는 base `cats`가 아니라 `cats_public_map` 뷰(공개·비숨김·비추모만
  담김). anon은 base `cats`에 컬럼 단위 권한만 있어 lat/lng·memorial 계열 컬럼 접근이 거부된다.
- **급식소·쉼터의 정확 위치는 텍스트로도 적지 않는다** — 지도 안내문에서 사용자에게도 금지 요청,
  공개 게시물의 위치성 텍스트는 `lib/location-patterns.ts`로 하드 차단(DM·서클은 경고 후 허용).
- 사진 업로드 시 GPS EXIF 자동 제거.
- 이 구조는 "위치정보를 수집·이용하지 않는 무의무 아키텍처"로 설계된 것(LBS 사업 신고 회피).
  정확 좌표를 새 경로로 노출하는 변경은 법적 지위를 바꾸므로 사장님 승인 필수.

## 인증·인가

- 인증은 Supabase Auth(카카오/구글 OAuth + 이메일). 실패 경로는 전부 `auth_error_logs` 적재:
  OAuth 거부(access_denied), 코드 교환 실패, 플로우 만료, DB 저장 실패 — 각각 provider·stage·
  UA와 함께 남겨 관리자 화면에서 패턴 분석한다.
- 가입 봇 방어: Cloudflare Turnstile(가입 폼).
- **API 라우트는 요청마다 인증 확인**(`supabase.auth.getUser()` 또는 Bearer 토큰 검증).
  크론 라우트는 `CRON_SECRET` 일치 검사.
- **관리자 작업은 이중 방어**: 서버에서 `requireAdmin()` + DB에서 admin RLS 정책. 어느 한쪽만
  믿지 않는다.
- 정지 계정은 `public.is_user_not_suspended(uid uuid)`로 차단. **인자를 받는 함수다** — RLS
  정책에서 `public.is_user_not_suspended(auth.uid())`로 호출(무인자 호출은 42883 에러).

## 인가 매트릭스 (요지)

| 주체 | 허용 | 명시적 불허 |
|---|---|---|
| 비로그인 | 공개 뷰 조회(cats_public_map·profiles_public), 랜딩·SEO 페이지, auth_error_logs insert | base 테이블 직접 조회, 정확 좌표, 쓰기 전반 |
| 로그인 일반 | 본인 행 쓰기(RLS `auth.uid() = user_id` 계열), 공개+본인+소속 서클 콘텐츠 조회 | 타인 행 수정·삭제, 정지 상태에서의 모든 쓰기 |
| 서클 멤버 | 해당 서클의 circle 가시성 고양이·채팅·비공개 사진(signed URL) | 다른 서클 자원 |
| 관리자 | 뉴스·병원·약품·유저·신고 관리 | — (단 requireAdmin+RLS 둘 다 통과해야) |
| service_role | 서버 API 내부에서 검증 후 사용 | **클라이언트 노출 절대 금지** |

- 새 테이블은 RLS 활성화 + SELECT/INSERT/UPDATE/DELETE 각각 정책을 갖춰야 배포 가능.

## 다중 수신 알림의 위조 방지 패턴

푸시를 여러 명에게 뿌리는 엔드포인트는 반드시: ① Bearer 인증 ② 호출자가 그 알림의 근거 행위를
실제로 했는지 서버에서 검증(서클 멤버인지 / 5분 내 실기록이 있는지) ③ 유저·대상별 rate limit.
이 3종이 없으면 임의 계정이 남에게 가짜 알림을 뿌리는 스팸·사회공학 벡터가 된다
(`/api/circle/notify-message`, `/api/cats/notify-watchers`가 기준 구현).

## 민감 데이터 취급

- 서버 에러 응답에 debug 정보(스택·쿼리·키)를 넣지 않는다.
- Sentry로 나가는 이벤트는 `lib/sentry-redact.ts`로 PII 제거, 로그는 `lib/log-sanitize.ts` 마스킹.
- 결제 관련 로그는 금액·식별자 마스킹. PII 암호화는 법적 의무 0건 확인(2026-08-04 감사) —
  단 `lib/crypto-pii.ts` 경로가 준비돼 있다.
- 텔레그램 운영 알림에 PII를 싣지 않는다(2026-08-26 결격 청산 항목).
- 서클 채팅 사진은 private 버킷 + 멤버 검증 후 signed URL. 공개 버킷에 넣지 않는다.
- 사용자 입력 URL은 `sanitizeImageUrl`/`sanitizeHttpUrl` 통과 필수(XSS·SSRF 방어), 본문 HTML은
  DOMPurify 계열로 소독.

## 자격증명 관리

- 모든 키는 Vercel 환경변수(프로덕션)와 로컬 `.env.local`. 코드·커밋에 키를 넣지 않는다.
- service_role 키·VAPID private·CRON_SECRET·Telegram 토큰은 서버 전용. `NEXT_PUBLIC_` 접두사가
  붙는 순간 클라이언트에 노출된다는 전제로 분류한다.
- 키 회전 시 Vercel 환경변수 교체 → 재배포. 과거 사고: env 값 끝에 리터럴 `\n`이 섞여 들어가
  인증 실패를 일으킨 적 있음 — 등록 시 개행 확인.

## 기록(감사) 대상

- 로그인 실패 전 단계(auth_error_logs), 퍼널 이벤트(funnel_events), 신고·제보(zone_reports 계열),
  환불·결제 처리 이력, 관리자 조치. 보존 기한은 스토리지 다이어트 크론이 관리(auth_error_logs 90일 등).

## 스팸·어뷰징 제한

- 쓰기 계열은 유저당 rate limit(케어 분당 8·일 120, 알림 트리거 분당 수회 등) — 클라 검사 +
  서버/트리거 이중. 인메모리 rate limit은 인스턴스 경계에서 느슨함을 전제로 설계한다.
- 프로필 잠금: anon의 base profiles 조회 0행(2026-08-03 검증 완료), 공개 정보는 `profiles_public`
  뷰로만.
