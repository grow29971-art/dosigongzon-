# profiles 락다운 실행 순서 — 2026-07-30 (실측 기반 갱신)

> 2026-07-24 `supabase_security_20260724_RUN_ORDER.md`의 **1번 항목만** 떼어내 갱신한 문서.
> 그때는 "불명"이던 프로덕션 상태를 2026-07-30에 REST 프로브로 **실측**해 확정했다.

---

## 실측된 프로덕션 상태 (2026-07-30, anon·service_role REST 프로브)

| 항목 | 상태 | 근거 |
|---|---|---|
| `profiles` 총 행수 | **344** | service_role `count=exact` |
| `profiles` SELECT 정책 | 🔴 **`USING(true)` 그대로** | anon이 남의 행 `id,nickname` 조회 성공(200). self+admin 정책이면 anon은 0행이어야 함 |
| `profiles_public` 뷰 | ✅ **존재** | anon 200 + 7개 컬럼(`id,nickname,avatar_url,admin_title,suspended,created_at,perfect_catch_count`) 전부 조회·필터 정상 |
| RPC `total_user_count` | 🔴 **미존재** | anon POST → `PGRST202` 404 |
| RPC `get_inviter_code` | 🔴 **미존재** | anon POST → `PGRST202` 404 |
| 앱 코드 repoint | 🔴 **미배포였음** → 이 문서와 함께 배포 | main에 `profiles_public` 참조 0건이었음 |
| anon 민감컬럼 | ✅ 회수됨 | `invite_code`·`coins`·`invited_by`·`marketing_push_enabled` → 42501 |
| **authenticated 민감컬럼** | 🔴 **회수 안 됨** | anon만 revoke했음(`supabase_profiles_anon_exposure_migration.sql`). 로그인 유저는 남의 `invite_code`·`coins` REST 덤프 가능 = **이번에 잠글 대상** |

---

## 실행 순서 (⚠ 순서 지킬 것)

| 단계 | 무엇 | 파일 | 주체 | 상태 |
|---|---|---|---|---|
| 1 | `profiles_public` 뷰 | `supabase_profiles_public_view_migration.sql` | SQL Editor | ✅ **이미 적용됨 — 건너뜀** |
| 2 | RPC 2종 생성 | `supabase_profiles_lockdown_rpcs_migration.sql` | **성우 / SQL Editor** | ⬜ 실행 필요 |
| 3 | 앱 코드 repoint 배포 | (커밋 + `vercel --prod`) | 코드 | ✅ 2026-07-30 배포 |
| 4 | **base RLS self+admin 잠금** | `supabase_profiles_authenticated_lockdown_migration.sql` | **성우 / SQL Editor** | ⬜ 실행 필요 |

> **2·3번은 순서 무관하게 만들어 뒀다.** 7/24 브랜치 원안은 가입자 수를 `total_user_count()` RPC로
> 옮겨서 "SQL 먼저, 배포 나중"을 강제했는데, 그러면 순서를 어기는 순간 홈·about·OG 이미지의
> 가입자 수가 **0명으로 표시되는 눈에 보이는 회귀**가 생긴다.
> 그래서 카운트 6곳은 RPC 대신 **`profiles_public` 뷰 count**로 바꿨다 — 이 뷰는 `security_invoker=off`(definer)라
> base 정책이 잠기기 전에도 후에도 344를 그대로 반환한다(2026-07-30 실측: anon count=344, base와 동일).
> `get_inviter_code()`도 RPC 실패 시 기존 직접조회로 폴백하도록 해서 미생성 구간에도 값이 정상이다.
>
> 결과적으로 **2번은 4번 이전이기만 하면 된다.** 안 해도 앱은 안 깨지지만, 4번 이후
> "나를 초대한 사람 코드"가 정상이려면 2번이 필요하다.
>
> **4번은 반드시 3번 배포 확인 후.** 4번을 먼저 실행하면 서클 멤버·차단목록·알림·공개 프로필·통합검색·이웃 목록이 전부 빈 화면이 된다.

---

## 3번(코드 repoint)에 포함된 변경 — 총 18곳

**7/24 브랜치에서 이식(cherry-pick `6b17431`) — 13곳**
- 남의 프로필 읽기 → `profiles_public`: `lib/blocks-repo.ts`, `lib/circle-chat-repo.ts`, `lib/circles-repo.ts`(3곳), `lib/notifications-repo.ts`, `app/circle/[circleId]/chat/page.tsx`, `app/circle/join/[ownerId]/page.tsx`
- 가입자 수 카운트 → **`profiles_public` count**(원안의 `rpc('total_user_count')`에서 변경): `app/about/page.tsx`, `app/celebrate/page.tsx`, `app/opengraph-image.tsx`, `app/components/HomeLanding.tsx`, `app/components/Event1000Banner.tsx`, `app/(main)/event/keyring/page.tsx`
- 초대자 코드 → `rpc('get_inviter_code')` + 직접조회 폴백: `lib/invites-repo.ts`

**7/30 신규 발견분 (7/24 이후 추가된 코드라 브랜치에 없었음) — 5곳**
- `lib/users-server.ts` 3곳 — 공개 프로필 페이지, 공개 스탯(`perfect_catch_count`), 동네 이웃 케어테이커 목록
- `app/api/search/route.ts` — 통합검색 유저 검색(anon 클라이언트)
- `app/(main)/admin/event-keyring/page.tsx` — 응모자 목록(관리자 화면이지만 브라우저 클라이언트라 RLS상 일반 유저 권한)

> 이 5곳을 빼먹고 4번을 실행했다면 공개 프로필·이웃 목록·통합검색이 조용히 빈 값이 됐을 것.

---

## 4번 실행 후 검증

```
-- SQL Editor
select count(*) from public.profiles;              -- admin 계정이면 344, 아니면 1
select public.total_user_count();                   -- 344 (정수)
```

앱에서:
- 홈/about/celebrate 가입자 수가 344로 정상 표시
- 마이페이지 코인·초대코드 정상(본인 행은 계속 읽힘)
- 서클 멤버·차단 목록·알림 닉네임/아바타 정상
- 공개 프로필(`/users/[id]`)·통합검색 유저 탭·동네 이웃 목록 정상
- 로그인 유저 JWT로 `GET /rest/v1/profiles?select=invite_code,coins` → **본인 1행만**(과거엔 344행)

---

## 롤백

각 SQL 파일 하단 `ROLLBACK` 주석 참조. 4번만 되돌리면 즉시 원상복구된다
(`drop policy profiles_select_self_or_admin` → `create policy ... using (true)`).
코드(3번)는 롤백 불필요 — `profiles_public` 뷰는 base 정책과 무관하게 계속 동작한다.
