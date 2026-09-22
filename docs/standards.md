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
- 아이콘은 lucide-react. 스타일은 Tailwind + 인라인 style 혼용이 관례(색 변수·토큰 참조).

## 디자인 토큰·화면 문법 (2026-09-16 「익숙한 동네앱」 — decisions/0007)

- 주색 테라코타 `#B05C36`은 **동결**(WAU 100 도달까지 재논의 없음). CTA 채움·활성 탭·선택 상태 전용이며
  장식(글로우·그라디언트·틴트 아이콘 박스)에 쓰지 않는다.
- 바탕 순백, 회색은 뉴트럴 `--color-gray-50…900`. 글자 회색(`text-main/sub/light`)은 흰 바탕 대비 4.5:1
  이상, `--color-text-muted`는 장식·비활성 전용(글자 금지).
- **하드코딩 hex 금지**: `app/**/*.tsx`의 6자리 hex는 0건이 기준. 허용 예외는 브랜드색(카카오 `#FEE500`·
  네이버 `#03C75A`), `**/opengraph-image.tsx`, `app/layout.tsx`의 theme-color, `app/darkcheck`, `app/api`
  메일 템플릿, 약품 가이드 DB 기본값. 검사: `node scripts/design-swap.mjs app --report` → `0 literals`.
  의미색도 리터럴이 아니라 토큰(`--color-error/-warning/-like/-care/-sage`).
- 라운드 상한 12px(`--radius-card/-modal/-sheet`), 입력·버튼·썸네일 8px(`--radius-input/-card-sm`), 칩 6px
  (`--radius-square`), 원형은 아바타·고양이 썸네일·원형 아이콘 버튼만. `rounded-2xl/3xl` 금지.
- 그림자는 FAB·바텀시트·모달·드롭다운에만(`--shadow-fab/-sheet/-modal/-raised`). 카드·리스트·헤더는
  1px `--color-border` 헤어라인. `--shadow-card/-card-sm/-primary`·`--color-warm-white`는 삭제 예정 별칭 —
  새 코드에서 쓰지 않는다.
- 카드 문법 금지: 카드 안 카드·색 테두리 카드·틴트 박스 안 아이콘 대신 흰 면 + 헤어라인 섹션 또는
  구분선 리스트(`UIListRow`). 화면 구성 요소(제목·버튼·칩·탭·배지·빈 상태)에 이모지 금지 — lucide 선
  아이콘. 사용자 데이터 본문의 이모지는 건드리지 않는다.
- 서체는 Pretendard 단일(세리프 금지). 제목 700, 800/900 남용 금지. 타이포 6단 토큰만.
- **카피 톤(2026-09-22 디자인 감사)**: UI 문구에 느낌표 금지(성공 토스트 포함), Sparkles(✨) 아이콘 금지, "발자취·여정·소중한·따뜻한
  순간" 같은 서정 문구 대신 기능 문장. 한 화면에 같은 의도의 CTA 둘 금지(채움+고스트 쌍, 띠배너 중첩). 페이지 인트로 모달·설명
  배너는 `SHOW_PAGE_INTROS=false`로 전역 OFF — 화면이 스스로 설명해야 한다. 로딩은 텍스트가 아니라 레이아웃 모양 스켈레톤.
- 다크모드 없음. 단 "다크 지원 선언 + 항상 라이트 렌더" 방어(globals.css `color-scheme: light dark`)와
  body·surface 배경 토큰 명시는 유지 — 순백 배경은 WebView 자동 다크닝의 1순위 반전 대상.
- 대규모 스타일 변경은 revert 기준선 커밋을 먼저 만들고, 브랜치에서 화면군마다 1커밋 후 main에 1회 머지.

## 데이터 불변 규칙

- 비정규화 스냅샷(author_name/avatar/level, cats.like_count 등)은 **의도적** — 정규화하거나
  소급 갱신하는 리팩터링 금지.
- 폐지된 게임 경제(카드 배틀·다마고치·코인) 코드를 복원하는 변경 금지.

## 입력 검증

- 사용자 입력 URL: `sanitizeImageUrl`/`sanitizeHttpUrl` 필수. HTML 본문: 렌더 시점 파서 기반 소독(`lib/html-sanitize-server.ts`) 필수.
- 서버 에러 응답에 debug 정보 노출 금지.

## 테스트

- 회귀가 무서운 순수 로직(환불 정책·케어 집계·보안 가드·온보딩 스텝)은 `tests/*.test.mjs`에
  node --test 단위 테스트를 둔다. 실행: `npm test`. E2E는 없다(의도 — 아래 표에 없는 걸 만들 때
  E2E부터 깔지 말 것).

## 문서 유지

- 프로젝트에서 알게 된 지속 가치가 있는 사실(함정·메커니즘·결정과 이유·운영 절차)은 이 `docs/`
  체계에 기록한다. 개발일지는 `box/개발일지_YYYYMMDD.md`.
