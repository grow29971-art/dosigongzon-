<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 에이전트 규칙

## 코드 수정 전
1. 해당 파일을 먼저 Read로 읽을 것. 구조를 모르고 수정하지 말 것.
2. Supabase 테이블 변경 시 RLS 정책도 함께 추가할 것.
3. 새 컬럼 추가 시 `alter table ... add column if not exists` 패턴 사용.

## 배포 전
1. `npx tsc --noEmit`으로 타입 체크 통과 확인.
2. 빌드 에러 시 `npm run build`로 상세 확인.
3. SQL 마이그레이션 파일은 `box/` 폴더에 작성, 사용자에게 실행 요청.

## 한국어
- 사용자는 한국어 사용자. 모든 UI 텍스트, 에러 메시지, 커밋 메시지를 한국어로.
- 커밋 메시지 형식: `feat:`, `fix:`, `docs:`, `data:` 등 prefix + 한국어 설명.

## Supabase
- 브라우저(클라이언트): `lib/supabase/client.ts` (`createBrowserClient`)
- 서버(RSC/API): `lib/supabase/server.ts` (`createServerClient`)
- service_role은 절대 클라이언트에서 사용 금지.
- RLS는 항상 켜져 있다고 가정. SELECT/INSERT/UPDATE/DELETE 각각 정책 필요.

## 파일 네이밍
- SQL 마이그레이션: `box/supabase_[기능명]_migration.sql`
- SQL 시드: `box/supabase_[기능명]_seed.sql`
- Repository: `lib/[도메인]-repo.ts`
- 개발일지: `box/개발일지_YYYYMMDD.md`
