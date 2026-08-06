-- ══════════════════════════════════════════
-- 방송(언론 노출) 전 권한 점검 — 2026-08-06
--
-- 목적: 트래픽이 몰리기 전에 "익명 사용자가 쓸 수 있는 구멍"이 남았는지 확인.
--       [확인 1~3]은 전부 읽기 전용이라 아무것도 바꾸지 않는다.
--       결과에 따라 아래 [조치]를 실행할지 판단한다.
--
-- 익명 프로브로 이미 확인된 것 (실행 불필요):
--   ✅ profiles 락다운   — anon SELECT 401, 0행 (2026-08-03 실행분 유지 중)
--   ✅ 공개 뷰 쓰기 차단  — profiles_public·cats_public_map PATCH/DELETE 401
--   ✅ EXIF 제거         — 업로드 시 canvas WebP 재인코딩으로 메타데이터 소실
--   ✅ 앱 내 특허 표기    — 코드에 "특허" 문자열 0건 (외부 채널은 사람이 눈으로 확인)
--
-- 익명 프로브로 판정 불가라 이 파일이 필요한 것:
--   ❓ anon 테이블 쓰기 grant가 남아 있는가 (RLS가 유일 방어선인지)
-- ══════════════════════════════════════════


-- ── [확인 1] anon에게 쓰기 권한이 남아 있는 테이블 ──
-- 0행이면 이상적. 목록이 나와도 RLS가 막고 있으면 즉시 위험은 아니지만,
-- 방어가 한 겹뿐이라는 뜻이므로 [조치 A]를 검토한다.
select table_name,
       string_agg(privilege_type, ',' order by privilege_type) as grants
  from information_schema.role_table_grants
 where grantee = 'anon'
   and table_schema = 'public'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 group by table_name
 order by table_name;


-- ── [확인 2] RLS가 꺼진 테이블 🔴 ──
-- 여기 뭔가 뜨면 그게 진짜 P0다. grant가 있든 없든 즉시 노출된다.
-- 0행이어야 정상.
select c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and not c.relrowsecurity
 order by 1;


-- ── [확인 3] RLS는 켜졌는데 정책이 0개인 테이블 ──
-- 이건 "전부 차단" 상태라 보안상 안전하지만, 앱이 그 테이블을 쓰고 있다면
-- 기능이 조용히 죽어 있다는 뜻이다. 목록이 나오면 기능 확인.
select c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relrowsecurity
   and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
 order by 1;


-- ══════════════════════════════════════════
-- [조치 A] 확인 1에 목록이 떴을 때 — 두 번째 방어선 세우기
--
-- ⚠ 지금 실행하지 말고, 확인 결과를 보고 판단할 것.
--   기존 테이블의 grant를 회수하면 앱의 직접 쓰기 경로가 깨질 수 있다.
--   (이 프로젝트는 쓰기 대부분을 RPC·service_role로 하지만 전수 확인 전엔 단정 금지)
--
-- 안전한 순서:
--   1) 앞으로 만들 객체부터 막는다 → box/supabase_default_privileges_lockdown_migration.sql
--   2) 기존 테이블은 확인 1 목록을 보고 하나씩 판단한다
-- ══════════════════════════════════════════

-- 개별 테이블 회수 예시 (확인 1 결과를 보고 대상만 골라서):
-- revoke insert, update, delete on public.<테이블명> from anon;

-- 되돌리기:
-- grant insert, update, delete on public.<테이블명> to anon;


-- ══════════════════════════════════════════
-- 방송 전 사람이 직접 해야 하는 것 (SQL 아님)
--   □ 외부 채널 특허 표기 점검 — 앱스토어 설명·크라우드펀딩·홈페이지·지원서·보도자료
--     "특허 완료/등록/보유" → "특허 출원 중(출원번호 10-2024-0030613)" 으로만 통일
--     (앱 코드는 2026-08-03 f3f99de 커밋으로 이미 정리됨)
--   □ 인터뷰에서 말할 숫자를 실물 기준으로 준비
--     등록 고양이 242 중 실물 108 / 펀드 투표 93표 중 실표 13
--     앱 화면은 그대로 두되, 외부 발화는 실물 수치로
-- ══════════════════════════════════════════
