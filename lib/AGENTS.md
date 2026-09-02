# lib/ — 도메인 로직·데이터 접근

## 범위

repo 계층(`*-repo.ts` 클라이언트용, `*-server.ts` RSC용), Supabase 클라이언트 3종, 도메인 상수·
정책 로직(환불·포인트·후원·호칭 등), 유틸(검증·마스킹·지역). UI 렌더링은 소관 밖 — JSX를 여기
두지 않는다(auth-context 등 Provider 제외).

## 파일 배치 규칙

- 새 도메인 데이터 접근은 `lib/[도메인]-repo.ts`(브라우저, `lib/supabase/client.ts` 사용) 또는
  `lib/[도메인]-server.ts`(RSC, `lib/supabase/server.ts` 사용)로. 하나의 파일이 두 클라이언트를
  섞지 않는다.
- 정책 숫자(후원율 10%·적립률 1/2/3%·제한치)는 상수/설정 파일에 한 곳만 두고 화면은 참조만 한다.

## 불변 규칙

- repo 함수는 실패 시 **한국어 메시지의 Error**를 던진다(화면이 그대로 토스트로 쓴다).
- 쓰기 계열 repo는 rate limit(`enforceUserActionLimit` 패턴)을 클라 측에서도 걸어둔다 —
  서버 트리거가 2차 방어지만 UX상 1차는 여기다.
- 작성자 스냅샷(author_name/avatar/level)은 insert 시 채워 넣는 것이 규칙 — "profiles 조인으로
  최신화"하는 리팩터링 금지.
- 부가 경로(푸시·계측·이벤트 dispatch)는 fire-and-forget으로 — 본 동작(insert)의 성공/실패에
  영향을 주면 안 된다. `void fetch(...).catch(() => {})` 패턴.
- `add_cat_card_exp` RPC는 이름에 card가 남았지만 돌봄 레벨 EXP의 살아 있는 경로다 — 정리 대상
  아님.

## 함정

- `listMy*` 계열은 비로그인에서 throw 대신 빈 값을 돌려주는 게 관례(홈이 비로그인에서도 렌더됨).
- 좌표를 다루는 함수는 퍼징 전/후를 타입이 아니라 함수 계약으로 구분하고 있다 — 정확 좌표를
  반환하는 함수를 비로그인 경로에 연결하지 않도록 호출부를 확인할 것.
- kst.ts의 시간 유틸을 두고 new Date() 로컬 타임존 계산을 직접 하지 말 것(서버는 UTC).

## 테스트 관점

- 순수 정책 로직(환불 판정·집계·플래그)을 바꾸면 `tests/*.test.mjs`의 해당 테스트를 함께 갱신하고
  `npm test`로 확인한다. 여기 테스트가 있는 파일 목록이 곧 "회귀가 무서운 로직" 목록이다.
