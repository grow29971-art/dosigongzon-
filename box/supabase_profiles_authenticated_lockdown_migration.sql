-- ══════════════════════════════════════════
-- 🔴 profiles authenticated PII 잠금 — 2단계 (2026-07-24)
-- 문제(7/23 팬테스트 HIGH·위험 B): profiles SELECT 정책이 USING(true)라
--   로그인 유저(authenticated)가 Supabase REST로 전 회원의
--   invite_code/coins/marketing_push_enabled/invited_by/약관·출석·보상 날짜를
--   교차 조회 가능(앱 UI로는 재현 불가, JWT로 REST 직접 치면 ~313명 덤프).
--   과거 email 핫픽스는 email 컬럼만 가렸고 나머지 민감컬럼은 방치.
--
-- 해결(개발일지 2단계 계획): base SELECT를 '본인·admin 행'으로 제한.
--   컬럼 REVOKE는 본인 coins/토글 조회까지 막아 부적절 → 행 단위 RLS로 잠근다.
--   본인 행은 계속 읽히고(마이페이지·토글 정상), 남의 행은 아예 안 보인다.
--   앱이 남의 프로필을 읽던 곳은 profiles_public 뷰 + RPC로 이미 repoint 완료.
--
-- ⚠⚠ 선행 조건 (반드시 순서 지킬 것 — 안 지키면 서클/초대/알림/카운트 깨짐):
--   1) profiles_public 뷰 존재      (supabase_profiles_public_view_migration.sql)
--   2) RPC 2종 존재                 (supabase_profiles_lockdown_rpcs_migration.sql)
--   3) 앱 코드 repoint 배포 완료     (profiles→profiles_public / RPC 전환 커밋)
--   → 위 3개 확인 후에만 이 파일 실행. 실행 전 supabase_security_verify_20260724.sql로 점검.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- base profiles SELECT를 본인·admin으로 제한
drop policy if exists "profiles_read_public_fields" on public.profiles;
drop policy if exists "profiles_read_all" on public.profiles;

create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   임의 계정 JWT로 GET /rest/v1/profiles?select=invite_code,coins
--     → 본인 1행만 반환(과거엔 전체). 남의 민감컬럼 덤프 불가.
--   앱: 서클 멤버/초대/차단/알림 닉네임·아바타 정상(profiles_public 경유),
--       "나를 초대한 사람 코드" 정상(get_inviter_code), 홈 가입자 수 정상(total_user_count).

-- ── ROLLBACK (다시 전체 공개로 — 위험 B 재노출, 권장 안 함) ──
-- drop policy if exists "profiles_select_self_or_admin" on public.profiles;
-- create policy "profiles_read_public_fields" on public.profiles
--   for select using (true);
-- notify pgrst, 'reload schema';
