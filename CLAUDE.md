# 도시공존 (City Coexistence)

길고양이 돌봄 시민 참여 플랫폼. Next.js 16(App Router) + Supabase + Kakao Maps, Vercel 배포,
1인 운영 프로덕션 서비스(dosigongzon.com, 가입 500+, 커밋 1,400+). 지도에 고양이를 기록하고
이웃과 함께 돌보는 것이 코어이고, 쇼핑(수익 10% 후원)·B2G가 수익 축이다. 규모에 맞지 않는
과설계(마이크로서비스·무거운 프레임워크 도입 등)는 이 프로젝트에 맞지 않는다.

## 문서 지도

```
city/
├── CLAUDE.md / AGENTS.md      ← 이 파일 (진입점, 두 파일 내용 동일)
├── docs/
│   ├── architecture.md        ← 시스템 구성·의존 방향·대표 흐름
│   ├── business-rules.md      ← 도메인 규칙(공개 범위·후원율·호칭·폐지 기능 등)
│   ├── security.md            ← 보안 정책(위치 비공개 계약·인가 매트릭스·위조 방지 패턴)
│   ├── standards.md           ← 어기면 깨지는 규칙 전체(커밋·DB·클라이언트 선택·토큰)
│   ├── engineering-notes.md   ← 함정 모음(이 PC·Supabase·인증·외부 서비스)
│   ├── operations.md          ← 개발·배포·마이그레이션·프로브 절차, 환경변수
│   ├── contracts.md           ← 외부 소비자 계약(TWA·크론·토스·푸시 페이로드)
│   └── tracking/
│       ├── status.md          ← 지금 어디까지 왔나 (완료/남은 것/차단 요인)
│       ├── decisions/         ← 트레이드오프 결정 기록(위치 아키텍처·후원율 등)
│       └── findings.md        ← 미해결 문제
├── app/AGENTS.md              ← 화면·컴포넌트 작업 규칙
├── app/api/AGENTS.md          ← API 라우트 작업 규칙
├── lib/AGENTS.md              ← repo 계층 작업 규칙
├── box/AGENTS.md              ← SQL 마이그레이션·개발일지 규칙
└── city-android/AGENTS.md     ← Android TWA 규칙
```

## 최상위 불변 규칙

1. **위치 비공개 계약** — 실좌표는 시스템에 존재하지 않는다(등록 시 브라우저에서 ±444m 오프셋,
   비로그인엔 +500m 추가 퍼징). 등록·수정 경로의 오프셋 우회 금지, 급식소 위치는 텍스트로도 금지,
   좌표 응답의 공유 캐시 금지. 완화는 사장님 승인 사안.
2. **service_role 키는 서버 전용.** 클라이언트 코드·`NEXT_PUBLIC_`에 절대 넣지 않는다.
   새 테이블은 RLS + 4종(SELECT/INSERT/UPDATE/DELETE) 정책 없이는 배포 불가.
3. **DB 변경은 `box/` SQL 파일로만** — 롤백 주석 동봉, 실행은 사장님, 실행 후 REST 프로브 검증.
4. **커밋 하나 = 변경 하나**, 배포 전 `npx tsc --noEmit` 통과. 완료 보고는 배포·반영 실측 후에만.
5. **UI·에러·커밋 메시지 전부 한국어.**

## 작업 전 읽기

- 기본: `docs/standards.md` → `docs/engineering-notes.md` → 작업 위치의 `AGENTS.md`.
- Next.js API를 쓰기 전: 이 버전은 학습 데이터와 다르다 — `node_modules/next/dist/docs/`의 해당
  가이드를 먼저 읽고 deprecation을 따른다.
- 좌표·가시성·비로그인 조회를 만지기 전: `docs/security.md`의 위치 계약 + engineering-notes의
  "anon 컬럼 권한" 항목.
- DB 스키마·트리거를 만지기 전: `docs/standards.md`의 DB 절 + engineering-notes의 Supabase 함정
  (unique×트리거, is_user_not_suspended 인자).
- 결제·환불·포인트를 만지기 전: `docs/business-rules.md`의 쇼핑 절 + `docs/contracts.md`의 토스 절.
  결제 게이트는 꺼져 있고 테스트 키로 켜는 것은 금지다.
- 푸시를 여러 명에게 보내는 기능을 만들기 전: `docs/security.md`의 위조 방지 패턴.

## 문제 발생 시

- **즉시 사장님 보고**: 정확 좌표가 비로그인에 노출되는 경로 발견, RLS 우회 가능 경로,
  결제·포인트 금액 조작 가능성, 가입·로그인 자체가 막히는 결함, 개인정보 유출.
- 그 외 당장 못 고치는 문제: `docs/tracking/findings.md`에 조건·영향·왜 지금 못 푸는지와 함께 기록.
- 새로 알게 된 함정·메커니즘·결정은 해당 `docs/` 파일에 남긴다 — 세션 밖으로 잃어버리지 않는 것이
  1인 운영 프로젝트의 생존 조건이다.
