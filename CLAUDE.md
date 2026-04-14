@AGENTS.md

# 도시공존 (City Coexistence)

길고양이 돌봄 시민 참여 플랫폼. Next.js 16 + Supabase + Kakao Maps.

## 기술 스택
- **프레임워크**: Next.js 16 (App Router, Turbopack)
- **DB/Auth**: Supabase (PostgreSQL + RLS + Auth + Storage + Realtime)
- **지도**: Kakao Maps SDK (services 라이브러리 포함)
- **스타일**: Tailwind CSS 4 + 인라인 스타일
- **배포**: Vercel (Production: city-amber-omega.vercel.app)
- **봇 방어**: Cloudflare Turnstile (signup)
- **AI**: Google Gemini (AI 집사 챗봇)

## 프로젝트 구조
```
app/(main)/          — 메인 레이아웃 (BottomNav 포함)
  map/               — 지도 (고양이/병원/약국/채팅)
  community/         — 커뮤니티 게시판
  messages/          — 1:1 쪽지
  mypage/            — 마이페이지 + 업적
  protection/        — 보호지침 + 약품 가이드
  admin/             — 관리자 (뉴스/병원/약품/유저/신고)
app/api/             — API 라우트 (chat/weather/auth/cron)
app/components/      — 공용 컴포넌트
lib/                 — 비즈니스 로직 (repo 패턴)
  supabase/          — Supabase 클라이언트 (client.ts, server.ts, proxy.ts)
  cats-repo.ts       — 고양이 CRUD + 레벨 시스템
  posts-repo.ts      — 커뮤니티 게시글
  dm-repo.ts         — 1:1 쪽지
  titles.ts          — 업적/타이틀 시스템
  admin-guard.ts     — requireAdmin() 가드
  url-validate.ts    — URL 검증 (XSS 방어)
box/                 — SQL 마이그레이션 + 개발일지 (배포 안 함)
```

## 핵심 규칙

### DB
- Supabase RLS 필수. 모든 테이블에 적절한 정책 존재해야 함.
- admin 작업은 `requireAdmin()` + RLS 이중 방어.
- `is_user_not_suspended()` 함수로 정지 유저 차단.
- 비정규화(author_name/avatar/level 스냅샷)는 의도적 — 변경 금지.

### 보안
- API 라우트는 인증 체크 필수 (`supabase.auth.getUser()`).
- URL은 `sanitizeImageUrl` / `sanitizeHttpUrl`로 검증.
- 서버 에러에 debug 정보 노출 금지.
- service_role 키는 서버에서만, 클라이언트에 절대 노출 X.

### 컴포넌트
- 읽기 전용 페이지 → 서버 컴포넌트 (약품 가이드 참고)
- 인터랙션 필요 → 클라이언트 컴포넌트 ("use client")
- `useRouter().back()`이 필요하면 별도 클라이언트 컴포넌트로 분리

### 스타일
- Tailwind + 인라인 style 혼용 (그라디언트, 색상 변수 등)
- 디자인 톤: 따뜻한 갈색(#C47E5A) 기반, 라운드(20-28px), 그림자 부드럽게
- 아이콘: lucide-react

### 배포
- `vercel --prod --yes`로 배포
- 환경변수는 Vercel Dashboard에서 관리
- SQL 마이그레이션은 Supabase SQL Editor에서 수동 실행

## 자주 쓰는 명령
```bash
npm run dev          # 개발 서버
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드
vercel --prod --yes  # 배포
start chrome "URL"   # 크롬으로 열기
```
