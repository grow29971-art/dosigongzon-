# 보안 조치 실행 순서 — 2026-07-24

7/23 4에이전트 팬테스트 확정 항목(A·B·supplier·dm)의 프로덕션 적용 순서.
**순서 중요.** 코드가 참조하는 DB 객체(뷰·RPC)가 프로덕션에 먼저 있어야 배포가 안 깨진다.

---

## 0. 현재 상태 점검 (먼저)
`box/supabase_security_verify_20260724.sql` → SQL Editor Run.
- `1_profiles민감컬럼` 🔴 → 위험 B 미조치(아래 진행)
- `2_products도매처` 🟡 → supplier 미조치
- `3_dm업데이트정책` / `5_dm컬럼UPDATE권한` 🟡 → dm 미조치
- `4_상점RPC권한` 🔴면 별건(audit_2 재실행)

---

## 1. profiles 락다운 (위험 B, 🔴)

의존성이 있으니 **이 하위 순서 그대로**:

| 단계 | 무엇 | 파일 | 실행 주체 |
|---|---|---|---|
| 1-1 | profiles_public 뷰 확인/생성 | `supabase_profiles_public_view_migration.sql` | SQL Editor (이미 있으면 재실행 무해) |
| 1-2 | RPC 2종 생성 | `supabase_profiles_lockdown_rpcs_migration.sql` | SQL Editor |
| 1-3 | **앱 코드 repoint 배포** | 브랜치 `security/profiles-lockdown` 머지 → `vercel --prod` | 코드 |
| 1-4 | base RLS self+admin 잠금 | `supabase_profiles_authenticated_lockdown_migration.sql` | SQL Editor |
| 1-5 | 검증 | `supabase_security_verify_20260724.sql` `1_profiles민감컬럼` ✅ 확인 | SQL Editor |

> 1-3(코드 배포)이 1-1·1-2보다 뒤, 1-4가 1-3보다 뒤. 어기면 서클/초대/알림/가입자수 카운트가 깨진다.

**1-3 코드 변경 내역** (브랜치에 준비):
- 남의 프로필 읽기 8곳 → `profiles_public` 뷰
  (circle chat/join, circle-chat-repo, circles-repo ×3, blocks-repo, notifications-repo)
- `lib/invites-repo.ts` 나를 초대한 사람 invite_code → `rpc('get_inviter_code')`
- 공개 가입자 수 카운트 6곳 → `rpc('total_user_count')`
  (opengraph-image, about, celebrate, HomeLanding, Event1000Banner, event/keyring)

---

## 2. products.supplier 잠금 (🟡)

| 단계 | 무엇 | 파일 | 실행 주체 |
|---|---|---|---|
| 2-1 | **admin 상품목록 supplier 읽기를 service_role 라우트로 이관 배포** | 브랜치 `security/profiles-lockdown` | 코드 |
| 2-2 | supplier 컬럼 REVOKE | `supabase_products_supplier_lockdown_migration.sql` | SQL Editor |
| 2-3 | 검증 | verify `2_products도매처` ✅ | SQL Editor |

> 2-1이 2-2보다 먼저. 어기면 관리자 상품관리 화면에서 supplier가 안 보인다.

---

## 3. direct_messages UPDATE 하드닝 (🟡)

의존성 없음. 언제든 실행 가능.

| 단계 | 무엇 | 파일 | 실행 주체 |
|---|---|---|---|
| 3-1 | with check + 컬럼 UPDATE grant | `supabase_dm_update_hardening_migration.sql` | SQL Editor |
| 3-2 | 검증 | verify `3_dm업데이트정책`·`5_dm컬럼UPDATE권한` ✅ | SQL Editor |

---

## 4. 이미 완료(배포됨)
- weather API 에러 env 변수명 노출 제거 (코드, main 배포)
- push/send userId UUID 검증 (코드, main 배포)

---

## 한 줄 요약
**dm(3)는 지금 바로 실행 OK. profiles(1)·supplier(2)는 "뷰/RPC/코드 먼저 → SQL 잠금 나중" 순서만 지키면 됨.**
