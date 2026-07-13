# 다른 PC에서 도시공존 작업하기 (2026-07-13)

## 핵심 개념
- **코드는 전부 GitHub에 있음** → 새 PC에선 USB 복사 말고 `git clone`이 정답 (깔끔·안전)
- **git에 안 올라가는 건 딱 하나**: `.env.local` (비밀키 모음) → 이것만 USB로 옮김
- `node_modules`(수천 개 파일)와 `.next`는 **절대 복사 금지** — 새 PC에서 재설치가 더 빠르고 안전

---

## USB에 담을 것 (딱 1개, 많아야 2개)
1. **`.env.local`** ← 필수. 프로젝트 루트(`C:\Users\1\city\.env.local`)에 있는 숨김 파일.
   Supabase·토스·카카오·Gemini 등 모든 비밀키가 여기 들어있음. GitHub엔 없음.
2. (선택) `.vercel/` 폴더 — Vercel 프로젝트 연결 정보. 없어도 `vercel link`로 재연결 가능.

> ⚠ `.env.local`은 비밀번호나 마찬가지 — USB 잃어버리지 않게 주의. 옮긴 뒤엔 USB에서 지우는 게 안전.

---

## 새 PC에 설치할 프로그램
1. **Git** — https://git-scm.com (코드 받기·푸시)
2. **Node.js 24.x** — https://nodejs.org (현재 PC: v24.15.0, npm 11.x). LTS 최신이면 OK
3. **Chrome** — 배포 확인·Supabase 대시보드용
4. **Claude Code** — 터미널에서 `npm install -g @anthropic-ai/claude-code` (또는 쓰던 방식)
5. **Vercel CLI** — `npm install -g vercel`

---

## 새 PC에서 순서대로

```bash
# 1. 코드 받기 (원하는 폴더에서)
git clone https://github.com/grow29971-art/dosigongzon-.git city
cd city

# 2. USB의 .env.local을 프로젝트 루트에 복사해 넣기
#    (탐색기로 city 폴더 안에 .env.local 붙여넣기)

# 3. 패키지 설치 (몇 분 걸림 — node_modules 새로 생성)
npm install

# 4. 개발 서버 실행 → localhost:3000 확인
npm run dev
```

이것만으로 로컬 개발은 바로 됨.

---

## 로그인·연동해야 할 계정 (배포·DB 작업 시)

| 무엇 | 어떻게 | 용도 |
|---|---|---|
| **GitHub** | `git push` 첫 시도 시 로그인 창 / 또는 토큰 | 코드 푸시 |
| **Git 사용자** | `git config --global user.email "grow29971@gmail.com"` + `user.name` | 커밋 이름 |
| **Vercel** | `vercel login` (이메일 인증) → `vercel link`로 city 프로젝트 연결 | `vercel --prod` 배포 |
| **Supabase** | Chrome에서 supabase.com 로그인 (SQL Editor 쓸 때) | DB 마이그레이션 |

> 환경변수(비밀키)는 이미 두 군데 다 있음:
> - **로컬**: `.env.local` (USB로 옮긴 것)
> - **프로덕션**: Vercel Dashboard에 이미 저장돼 있음 (새로 넣을 필요 없음)

---

## 자주 쓰는 명령 (프로젝트 CLAUDE.md에도 있음)
```bash
npm run dev          # 개발 서버
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드
vercel --prod --yes  # 배포
```

---

## 주의사항
- **두 PC에서 번갈아 작업 시**: 작업 시작 전 항상 `git pull` 먼저 (최신 코드 받기),
  끝나면 `git push` (안 하면 다른 PC에서 충돌남)
- **city-android 폴더**: 안드로이드 앱 껍데기(TWA). 웹 작업만이면 안 건드려도 됨.
  (빌드 산출물이 git에 잡히는데, 무시하고 웹 코드만 커밋하면 됨)
- **Claude Code 메모리**: `C:\Users\1\.claude\...`의 프로젝트 메모리는 이 PC 로컬.
  새 PC의 Claude Code는 기억이 없으니, 중요 맥락은 이 box/ 폴더 문서로 인수인계됨.
