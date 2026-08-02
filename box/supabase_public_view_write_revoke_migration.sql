-- ══════════════════════════════════════════
-- 🔴 P0 CRITICAL — 공개 definer 뷰의 익명 쓰기 권한 회수 (2026-08-02)
-- 실행 위치: Supabase Dashboard → SQL Editor   ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
-- ✅ 적용·검증 완료 (2026-08-02): SQL Editor 실행 성공. anon 키 재프로브 결과
--    profiles_public/cats_public_map SELECT=200(읽기 보존), PATCH/DELETE=401(쓰기 차단).
--    감사(anon 키 전수 프로브): 코드 정의 뷰 5개 중 악용가능은 profiles_public·
--    cats_public_map 2개뿐(=수정됨). 나머지(v_recent_cat_location_changes·my_invite_stats·
--    donation_totals)는 JOIN/집계뷰라 쓰기 실행 불가(PATCH=500/GET=200, 204 없음).
--    ⚠️ 단 그 500(401 아님)이 근본원인 확증: 신규 뷰에 anon/authenticated 쓰기권한이
--       default privileges 로 자동 상속됨 → P1로 ALTER DEFAULT PRIVILEGES 하드닝 필요
--       (다음에 만드는 단순 단일테이블 뷰는 또 태어나며 뚫린다).
-- ══════════════════════════════════════════
--
-- 【실측 확증 (2026-08-02 REST 침투)】
--   anon publishable 키만으로 아래가 실제로 커밋됨(테스트 후 즉시 원복):
--     PATCH /rest/v1/profiles_public?id=eq.<유저>  → 204, 닉네임 실제 변경됨
--     PATCH /rest/v1/cats_public_map?id=eq.<고양이> → 204, like_count 실제 변경됨
--     DELETE 도 권한 존재(204).
--   대조군: base 테이블(profiles/cats/posts)은 PATCH가 204여도 RLS가 0행 차단 → 미변경.
--
-- 【근본 원인】
--   profiles_public / cats_public_map 은 security_invoker=off(뷰 소유자=postgres 권한
--   으로 실행)라 base 테이블의 RLS를 우회한다. 그런데 두 뷰 생성 마이그레이션은
--   `grant select ... to anon, authenticated` 만 명시했는데도 INSERT/UPDATE/DELETE 가
--   통과한다 — Supabase가 스키마에 부여한 광역 grant(또는 ALTER DEFAULT PRIVILEGES)로
--   신규 객체(이 뷰 포함)에 anon/authenticated 쓰기 권한이 자동 상속됐기 때문.
--   base 테이블은 RLS가 막지만, definer 뷰는 RLS를 우회하므로 쓰기가 그대로 커밋된다.
--
-- 【영향(유명해졌을 때)】 익명 스크립트 1개로:
--   - 전 회원 nickname/avatar_url 일괄 defacement, avatar를 추적/악성 호스트로 교체
--   - admin_title='official_volunteer' 로 공식 스태프 사칭
--   - suspended=true 대량 세팅(계정 잠금 DoS) / false 로 정지 유저 부활
--   - cats_public_map 으로 전 고양이 이름·설명 변조, DELETE 대량 파괴, hidden=false 강제노출
--
-- 【이 파일의 조치】 공개 뷰는 읽기 전용이어야 한다 → 두 뷰의 쓰기 권한 명시적 회수.
--   base 테이블 grant 는 건드리지 않는다(RLS가 정상 방어 중이므로 정상 유저 기능 유지).
-- ══════════════════════════════════════════

-- ────────────────────────────────
-- 1) 즉시 차단 — 알려진 공개 뷰 2개의 쓰기 권한 회수
-- ────────────────────────────────
revoke insert, update, delete on public.profiles_public from anon, authenticated;
revoke insert, update, delete on public.cats_public_map  from anon, authenticated;

-- ────────────────────────────────
-- 2) 감사 — 다른 뷰에도 같은 구멍이 있는지 반드시 확인할 것
--    (anon/authenticated 에게 쓰기 권한이 있는 '뷰'를 전수 나열.
--     특히 security_invoker=off 뷰는 RLS 우회 → 쓰기 권한이 곧 취약점)
-- ────────────────────────────────
-- 2-a) anon/authenticated 쓰기 권한이 살아있는 모든 뷰:
select
  c.relname                                          as view_name,
  g.grantee,
  g.privilege_type,
  coalesce(
    (c.reloptions::text like '%security_invoker=on%')
    or (c.reloptions::text like '%security_invoker=true%'),
    false
  )                                                  as security_invoker_on
from pg_class c
join pg_namespace n       on n.oid = c.relnamespace
join information_schema.role_table_grants g
     on g.table_schema = n.nspname and g.table_name = c.relname
where c.relkind = 'v'
  and n.nspname = 'public'
  and g.grantee in ('anon', 'authenticated')
  and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by view_name, g.grantee, g.privilege_type;
--   → 위 결과에 나오는 뷰는 전부 아래처럼 쓰기 회수할 것(특히 security_invoker_on=false):
--   revoke insert, update, delete on public.<뷰이름> from anon, authenticated;

-- 2-b) (선택) 향후 신규 뷰에도 쓰기가 자동 상속되지 않도록 default privileges 점검.
--     아래는 '진단용 조회'다 — 결과를 보고 판단 후 별도 조치(이 파일에선 변경 안 함):
select defaclrole::regrole as grantor, defaclobjtype, defaclacl
from pg_default_acl;
--   defaclacl 에 anon=arwd / authenticated=arwd 같은 광역 쓰기가 보이면,
--   ALTER DEFAULT PRIVILEGES ... REVOKE 로 좁히는 별도 마이그레이션을 만들 것.

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────
-- 3) 검증 — 실행 후 anon 키로 재프로브(대시보드 count 는 무의미: postgres 롤이라 항상 통과)
-- ────────────────────────────────
--   PATCH /rest/v1/profiles_public?id=eq.<유저> {"nickname":"x"}  → 401/403 기대(과거 204)
--   PATCH /rest/v1/cats_public_map?id=eq.<고양이> {"like_count":1} → 401/403 기대
--   GET   /rest/v1/profiles_public?select=id (Prefer: count=exact) → 여전히 정상(읽기는 유지)
--   앱: 홈 가입자 수·공개 프로필·지도 마커 정상(읽기 경로라 영향 없음)

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기 — 취약 상태로 복귀하므로 권장하지 않음)
-- ------------------------------------------------------------
-- grant insert, update, delete on public.profiles_public to anon, authenticated;
-- grant insert, update, delete on public.cats_public_map  to anon, authenticated;
-- ══════════════════════════════════════════
