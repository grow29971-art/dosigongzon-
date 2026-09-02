# 규칙 (어기면 깨지는 것들)

## 언어

- UI 텍스트·에러 메시지·커밋 메시지는 **전부 한국어**. 사용자 노출 문자열에 영어를 남기지 않는다
  (기능 제목이 영어로 남아 있던 것을 2026-09-02에 일괄 교체했다 — 재발 금지).

## 커밋·배포

- 커밋 형식: `feat:`/`fix:`/`docs:`/`data:` 등 prefix + 한국어 설명.
- **커밋 하나에 변경 하나** — 언제든 그 커밋만 revert할 수 있어야 한다.
- 배포 전 게이트: `npx tsc --noEmit` 통과 필수. 로컬 `npm run build`는 이 PC에서 불가하므로
  빌드 성공 여부는 배포 파이프라인에서 확인한다.
- 배포는 `git push` → Vercel 자동 배포. 완료 확인 전에 "배포됐다"고 보고하지 않는다.
- 색 치환·대규모 스타일 변경은 revert 기준선 커밋을 먼저 만들고 진행한다.

## DB 변경

- **모든 DB 변경은 `box/supabase_[기능명]_migration.sql` 파일로 남긴다.** SQL Editor에 인라인으로
  치고 버리는 것 금지 — 파일 없이 실행된 변경은 재현 불가가 된다.
- 마이그레이션 파일에는 **롤백 SQL을 주석으로 동봉**한다.
- 컬럼 추가는 `alter table ... add column if not exists` 패턴.
- **새 테이블 = RLS 활성화 + SELECT/INSERT/UPDATE/DELETE 각각 정책**. 정책 없는 테이블은 배포 불가.
- 실행 주체는 사장님(Supabase SQL Editor). 에이전트는 파일 작성 + 실행 요청 + 실행 후 REST
  프로브로 반영 검증까지가 소임.
- `funnel_events`에 새 스텝을 추가하려면 CHECK 제약 마이그레이션이 선행돼야 한다 — 코드만 바꾸면
  insert가 조용히 실패한다.
- auth.users·profiles에 트리거를 더할 때는 unique 제약과의 충돌 회피를 트리거 안에서 처리한다
  (충돌이 가입/로그인 자체를 롤백시킨다).

## Supabase 클라이언트 선택

- 브라우저: `lib/supabase/client.ts`. 세션 필요한 RSC/API: `lib/supabase/server.ts`.
  세션 불필요한 공개 서버 조회(랜딩·ISR·SEO): `lib/supabase/anon.ts` — 요청 쿠키에 묶이면 안 되는
  곳에 server.ts를 쓰지 않는다. service_role: `lib/supabase/service.ts` — **서버에서 인증·검증
  후에만, 클라이언트 금지**. 미들웨어 세션 갱신은 `lib/supabase/proxy.ts` 경유(직접 구현 금지).
- 비로그인 경로에서 cats·profiles를 읽을 땐 base 테이블이 아니라 공개 뷰
  (`cats_public_map`·`profiles_public`)를 사용한다.

## 코드 구조

- 데이터 접근은 `lib/[도메인]-repo.ts`(클라이언트)·`lib/[도메인]-server.ts`(서버 전용)로만.
  컴포넌트에서 supabase 쿼리를 직접 짜지 않는다.
- 읽기 전용 페이지는 서버 컴포넌트, 인터랙션 필요하면 `"use client"`. `useRouter().back()`이
  필요한 부분은 별도 클라이언트 컴포넌트로 분리.
- 저활용 기능은 삭제하지 않고 `SHOW_*` 플래그로 숨긴다(복원 가능성 보존).
- 아이콘은 lucide-react. 스타일은 Tailwind + 인라인 style 혼용이 관례(그라디언트·색 변수).

## 디자인 토큰

- 테마색은 테라코타 계열로 **동결**(WAU 100 도달까지 재논의 없음). 새 하드코딩 hex를 늘리지 말고
  기존 CSS 변수(`--color-primary` 등)와 그림자 토큰을 쓴다.
- 다크모드 없음 전제로 색을 정의하지 말 것 — 기존 토큰이 이미 라이트 기준.

## 데이터 불변 규칙

- 비정규화 스냅샷(author_name/avatar/level, cats.like_count 등)은 **의도적** — 정규화하거나
  소급 갱신하는 리팩터링 금지.
- 폐지된 게임 경제(카드 배틀·다마고치·코인) 코드를 복원하는 변경 금지.

## 입력 검증

- 사용자 입력 URL: `sanitizeImageUrl`/`sanitizeHttpUrl` 필수. HTML 본문: DOMPurify 소독 필수.
- 서버 에러 응답에 debug 정보 노출 금지.

## 테스트

- 회귀가 무서운 순수 로직(환불 정책·케어 집계·보안 가드·온보딩 스텝)은 `tests/*.test.mjs`에
  node --test 단위 테스트를 둔다. 실행: `npm test`. E2E는 없다(의도 — 아래 표에 없는 걸 만들 때
  E2E부터 깔지 말 것).

## 문서 유지

- 프로젝트에서 알게 된 지속 가치가 있는 사실(함정·메커니즘·결정과 이유·운영 절차)은 이 `docs/`
  체계에 기록한다. 개발일지는 `box/개발일지_YYYYMMDD.md`.
