-- ══════════════════════════════════════════════════════════════
-- 보안감사 2026-08-04 — P0 조치 (순서대로 실행)
-- 13에이전트 감사 + 적대적 검증 + 원탁회의 결과.
-- 각 단계는 독립적이며, 실행 후 검증 쿼리로 반드시 확인할 것.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- [STEP 0] 확인 먼저 — 경제성 RPC 권한 (실행 아님, 조회만)
-- 결과가 1행이라도 나오면 → STEP 1 실행. 0행이면 → STEP 1 건너뛰고 STEP 2로.
-- ══════════════════════════════════════════════════════════════

select p.proname, r.grantee, r.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join information_schema.routine_privileges r
  on r.routine_schema = 'public' and r.routine_name = p.proname
where n.nspname = 'public'
  and p.proname in ('buy_shop_item_atomic','equip_item_atomic','consume_user_item',
                    'increment_coins','award_care_bonus_atomic')
  and r.grantee in ('anon','authenticated','public')
  and r.privilege_type = 'EXECUTE';


-- ══════════════════════════════════════════════════════════════
-- [STEP 1] (STEP 0이 1행 이상일 때만) 경제성 RPC 실행권한 회수
-- 이 함수들은 p_user_id를 인자로 받는 SECURITY DEFINER라, 로그인 유저가
-- 남의 코인·아이템을 조작할 수 있다. 서버 라우트는 전부 service_role 경유라
-- 회수해도 정상 동작한다(감사 확인됨).
-- → box/supabase_economy_rpc_lockdown_migration.sql 파일 내용을 실행할 것.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- [STEP 2] 🔴 cat-photos 버킷 익명 목록조회(list) 차단
-- 실측(2026-08-04): 익명 키만으로 POST /storage/v1/object/list/cat-photos 가
-- 200 + 유저 UUID 폴더 80개를 열거. "누가 언제 몇 장 올렸는가"가 통째로 열림.
-- 대조군 circle-photos는 0개 반환(정상) — 그 구성을 따라간다.
--
-- 주의: 버킷을 private으로 바꾸지 말 것. 공개 지도의 고양이 사진이 전부 깨진다.
-- 여기서는 "정책 기반 SELECT(=list)"만 authenticated로 좁힌다.
-- 공개 URL(/object/public/cat-photos/...) 직접 접근은 버킷의 public 플래그가
-- 담당하므로 이 변경의 영향을 받지 않는다.
-- ══════════════════════════════════════════════════════════════

drop policy if exists "cat_photos_read_public" on storage.objects;

create policy "cat_photos_read_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cat-photos');

-- 검증 A (SQL): 정책이 authenticated로만 남았는지
-- select polname, polroles::regrole[] from pg_policy
-- where polrelid = 'storage.objects'::regclass and polname like 'cat_photos%';

-- 검증 B (필수, 익명 프로브): 아래가 [] 를 반환해야 성공
--   POST https://sozxbnvgsougkliibnxl.supabase.co/storage/v1/object/list/cat-photos
--   headers: apikey=<publishable>, body: {"prefix":"","limit":10}
-- 검증 C (필수, 지도 정상 확인): 공개 사진 URL 하나를 브라우저 시크릿창에서 열어
--   여전히 이미지가 보이는지 확인 (안 보이면 즉시 롤백).


-- ══════════════════════════════════════════════════════════════
-- [STEP 3] 🟠 daily_stats 익명 전량 공개 차단
-- 실측: 익명 GET으로 106행(일별 실방문 수 35~53) 전부 조회됨.
-- 보안 침해는 아니지만 언론 노출 직전 사업지표가 그대로 열려 있는 상태.
-- ══════════════════════════════════════════════════════════════

drop policy if exists "daily_stats_read_all" on public.daily_stats;

create policy "daily_stats_read_admin"
  on public.daily_stats for select
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 검증: 익명 GET /rest/v1/daily_stats?select=* → [] 또는 401 이어야 함.
-- ⚠️ 관리자 통계 화면이 daily_stats를 읽는다면 그 화면이 깨지는지 먼저 확인.
--    (admins 테이블 컬럼명이 user_id가 아니면 아래 롤백 후 컬럼명 맞춰 재실행)


-- ══════════════════════════════════════════════════════════════
-- 진위 확인용 (참고 쿼리 — 실행해서 결과만 알려주면 심각도 재판정에 씀)
-- ══════════════════════════════════════════════════════════════

-- (a) 신고 도배 방어 트리거 실재 확인 — 없으면 "신고 3건 자동숨김" 오탐 판정이 뒤집힘
select tgname from pg_trigger where tgrelid = 'public.reports'::regclass and not tgisinternal;

-- (b) 비공개 돌봄기록 사진 존재 여부 — 0이 아니면 STEP 2의 심각도가 올라감
select count(*) from public.care_logs where is_private and photo_url is not null;


-- ══════════════════════════════════════════════════════════════
-- ── 롤백 (문제 발생 시 그 단계만 되돌릴 것) ──
-- ══════════════════════════════════════════════════════════════

-- STEP 2 롤백:
-- drop policy if exists "cat_photos_read_authenticated" on storage.objects;
-- create policy "cat_photos_read_public" on storage.objects for select using (bucket_id = 'cat-photos');

-- STEP 3 롤백:
-- drop policy if exists "daily_stats_read_admin" on public.daily_stats;
-- create policy "daily_stats_read_all" on public.daily_stats for select using (true);
