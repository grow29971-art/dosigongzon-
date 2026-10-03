-- ══════════════════════════════════════════
-- 공개 뷰 쓰기 권한 재회수 (10/3 라이브 권한 전수 조회에서 발견) — 🔴 RLS 우회
-- 증상: profiles_public(소유자 postgres, security_invoker 아님, 자동 수정 가능 뷰 is_updatable=YES)에
--   anon·authenticated의 INSERT/UPDATE/DELETE 권한이 살아 있었다 → 비로그인이 PATCH /rest/v1/profiles_public 로
--   뷰 소유자 권한(RLS 미적용)으로 남의 profiles 행(닉네임·아바타·suspended 등)을 바꾸거나 지울 수 있는 경로.
-- 원인: 8/6 supabase_public_view_write_revoke_migration.sql로 회수했으나, 8/27 카드 폐지(supabase_card_system_removal_20260827.sql)가
--   뷰를 drop·create로 다시 만들면서 Supabase 기본 권한(새 객체에 anon·authenticated ALL)이 되살아났다.
--   → 뷰를 다시 만드는 마이그레이션은 반드시 revoke를 같은 파일에 넣을 것(engineering-notes 기록).
-- 나머지 4개 뷰는 집계·조인이라 수정 불가(is_updatable=NO)지만 같은 원칙으로 함께 회수. 앱 코드의 뷰 쓰기 0건(grep 확인).
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF — 2026-10-03 실행·검증(뷰 5개 anon·authenticated 쓰기 false, select 유지)
-- ══════════════════════════════════════════

revoke insert, update, delete, truncate on public.profiles_public from public, anon, authenticated;
revoke insert, update, delete, truncate on public.donation_totals from public, anon, authenticated;
revoke insert, update, delete, truncate on public.my_invite_stats from public, anon, authenticated;
revoke insert, update, delete, truncate on public.v_recent_cat_location_changes from public, anon, authenticated;
revoke insert, update, delete, truncate on public.cats_public_map from public, anon, authenticated;

-- ── 검증 ──
-- select c.relname, has_table_privilege('anon', c.oid, 'update') anon_u, has_table_privilege('authenticated', c.oid, 'update') auth_u,
--        has_table_privilege('anon', c.oid, 'select') anon_sel
--   from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v';   → 쓰기 전부 false, profiles_public select는 true 유지
-- ── 롤백 (권장하지 않음 — 구멍이 다시 열린다) ──
-- grant insert, update, delete on public.profiles_public to anon, authenticated;
