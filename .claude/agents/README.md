# Claude Code Agents — 도시공존

1인 사업자 IT 개발 + 사업 운영을 위한 에이전트 모음.
스택: **Next.js 16 (App Router) + Supabase + Vercel** (Flutter/NestJS 아님).

## 네이밍 규칙
`ag_[계열]_[이름].md` — frontmatter `name:`과 파일명(확장자 제외) 일치 필수.
- 계열: **dev**(개발) / **biz**(사업) / **qa**(검증) / **ops**(인프라·보안)

## 에이전트 목록

### 🏗️ DEV
- **ag_dev_nextjs** — Next.js App Router + Supabase 풀스택 (API·RSC·RLS·마이그레이션)
- **ag_dev_app-designer** — 모바일 웹앱 UI/UX (React+Tailwind 변환 힌트 병기)

### 💰 BIZ
- **ag_biz_bm** — 사업/BM/수익화/시장
- **ag_biz_korean-psych** — 한국인 심리 8축 마케팅·카피 (Before/After)
- **ag_biz_research** — 데이터·수치 검증 (누구 편도 아닌 데이터 편)

### 🛡️ QA
- **ag_qa_test** — Next.js/TS 테스트·RLS 침투 검증
- **ag_qa_devils-advocate** — 악마의 변호인 (가정 파괴·실패 시나리오)

### ☁️ OPS
- **ag_ops_infra** — Vercel + Supabase 배포·크론·비용
- **ag_ops_security** — 보안·RLS·개인정보보호법
- **ag_ops_crypto-env** — 환경변수·시크릿·키 회전

## 사용 예시
```
"회원 API 만들어줘"              → ag_dev_nextjs
"홈 화면 UI 설계해줘"            → ag_dev_app-designer
"이 앱 BM 분석해줘"             → ag_biz_bm
"한국인 관점에서 푸시 카피 봐줘"  → ag_biz_korean-psych
"RLS 뚫리는지 검증해줘"          → ag_qa_test
"이 아이디어 반박해줘"           → ag_qa_devils-advocate
"Vercel 배포·크론 설정해줘"      → ag_ops_infra
"시크릿 노출 점검해줘"           → ag_ops_crypto-env
```

## 토론 조합 (의사결정 검증)

### 사업 아이디어 3인 토론
```
이 아이디어 세 명이 토론해줘.
ag_biz_bm → ag_qa_devils-advocate → ag_biz_research 순서로
각자 입장 밝히고 서로 반박해줘. [아이디어]
```

### 한국 시장 진출 4인 토론
```
ag_biz_bm → ag_biz_korean-psych → ag_qa_devils-advocate → ag_biz_research
```

### API 설계 → 보안 검증 페어
```
"회원 API 설계하고 RLS 보안 점검까지 해줘"
→ ag_dev_nextjs + ag_ops_security
```

## 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026.04 | `ag_` 네이밍 4계열 도입, korean-psych·토론 조합 |
| 2026.07 | 도시공존 스택에 맞춰 재작성: flutter 제거, nestjs→nextjs, ops를 Vercel+Supabase 기준으로 |
