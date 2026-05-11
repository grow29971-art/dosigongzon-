-- ══════════════════════════════════════════════════════════════
-- Supabase 용량 다이어트 — 진단 + 안전 정리 모음
-- 작성: 2026-05-11
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
--
-- 사용 방법:
--   1) Part 1 (진단) 먼저 실행 — 어디가 큰지 확인
--   2) Part 2 (안전 정리) — 보존 기간 지난 로그 자동 삭제
--   3) Part 3~5는 결과 보고 필요한 것만 골라 실행
--   4) 마지막 Part 6 VACUUM 으로 디스크 회수
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- PART 1. 진단 — 어디서 용량을 잡아먹는지 (READ ONLY)
-- ══════════════════════════════════════════════════════════════

-- 1-1. 테이블별 디스크 사용량 TOP 30 (인덱스 포함)
select
  schemaname || '.' || relname              as table_name,
  pg_size_pretty(pg_total_relation_size(relid))  as total_size,
  pg_size_pretty(pg_relation_size(relid))        as data_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
  n_live_tup                                as live_rows,
  n_dead_tup                                as dead_rows
from pg_stat_user_tables
where schemaname in ('public','storage')
order by pg_total_relation_size(relid) desc
limit 30;

-- 1-2. Storage 버킷별 파일 개수 + 합계 용량
select
  bucket_id,
  count(*)                                          as file_count,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_size
from storage.objects
group by bucket_id
order by sum((metadata->>'size')::bigint) desc nulls last;

-- 1-3. cat-photos 버킷 — 사용자별 용량 TOP 20
select
  (storage.foldername(name))[1]                     as user_id,
  count(*)                                          as file_count,
  pg_size_pretty(sum((metadata->>'size')::bigint))  as total_size
from storage.objects
where bucket_id = 'cat-photos'
group by user_id
order by sum((metadata->>'size')::bigint) desc nulls last
limit 20;

-- 1-4. 전체 데이터베이스 크기
select pg_size_pretty(pg_database_size(current_database())) as db_size;


-- ══════════════════════════════════════════════════════════════
-- PART 2. 안전 정리 — 시간 지난 로그/임시 데이터 (즉시 실행 OK)
-- ══════════════════════════════════════════════════════════════
-- 아래는 모두 "쌓여서 의미 없어지는 데이터"라 기능에 영향 없음.
-- ✅ 이 PART 2는 매일 02:00 KST에 /api/cron/storage-diet 가 자동 실행함.
--    수동 실행은 진단·즉시 정리가 필요할 때만.

-- 2-1. 방문자 dedupe — 30일 지난 행 (테이블 없으면 skip)
do $$
begin
  if to_regclass('public.anon_visit_dedupe') is not null then
    delete from public.anon_visit_dedupe
    where visit_date < (current_date - interval '30 days');
  end if;
end $$;

-- 2-2. 푸시 알림 발송 로그 — 30일 지난 행
-- (push_alert_log_migration.sql 주석에 "30일 이상 자동 정리" 명시)
do $$
begin
  if to_regclass('public.push_alert_log') is not null then
    delete from public.push_alert_log
    where sent_at < now() - interval '30 days';
  end if;
end $$;

-- 2-3. 로그인 에러 로그 — 90일 지난 행
-- (패턴 분석용이라 90일이면 충분)
do $$
begin
  if to_regclass('public.auth_error_logs') is not null then
    delete from public.auth_error_logs
    where created_at < now() - interval '90 days';
  end if;
end $$;

-- 2-4. (선택) 더 공격적으로 줄이고 싶을 때 — 위 보존기간을 짧게
-- delete from public.push_alert_log    where sent_at    < now() - interval '7 days';
-- delete from public.auth_error_logs   where created_at < now() - interval '30 days';


-- ══════════════════════════════════════════════════════════════
-- PART 3. 더미 데이터 정리 — 이미 cleanup 파일 있음
-- ══════════════════════════════════════════════════════════════
-- box/cleanup_dummy_cats.sql, box/cleanup_test_cats.sql 참고
-- caretaker_id IS NULL = 시드 더미. 운영 정착됐으면 삭제 권장.

-- 3-1. 더미 고양이 개수 확인 (먼저 실행)
select
  count(*) filter (where caretaker_id is null)     as 더미_수,
  count(*) filter (where caretaker_id is not null) as 유저등록_수
from public.cats;

-- 3-2. 위 결과 보고 더미가 많으면 (cat_comments, care_logs 등은 CASCADE)
-- delete from public.cats where caretaker_id is null;


-- ══════════════════════════════════════════════════════════════
-- PART 4. 스토리지 고아 파일 — DB에서 안 쓰는 파일 찾기
-- ══════════════════════════════════════════════════════════════
-- ⚠ 실수로 살아있는 파일을 지우면 복구 불가. 반드시 SELECT 먼저!

-- 4-1. cat-photos 버킷 고아 파일 — cats / cat_comments / care_logs 어디서도 참조 안 됨
-- 컬럼:
--   cats.photo_url        (text)
--   cats.photo_urls       (text[])
--   cat_comments.photo_url(text)
--   care_logs.photo_url   (text)
with referenced_urls as (
  select photo_url as url from public.cats where photo_url is not null
  union all
  select unnest(photo_urls)   from public.cats where photo_urls is not null
  union all
  select photo_url from public.cat_comments where photo_url is not null
  union all
  select photo_url from public.care_logs    where photo_url is not null
),
referenced_names as (
  -- URL의 cat-photos/ 이후만 추출 (bucket prefix 제거)
  select regexp_replace(url, '^.*/cat-photos/', '') as obj_name
  from referenced_urls
  where url like '%/cat-photos/%'
)
select
  o.name,
  pg_size_pretty((o.metadata->>'size')::bigint) as size,
  o.created_at
from storage.objects o
where o.bucket_id = 'cat-photos'
  and o.name not in (select obj_name from referenced_names)
order by (o.metadata->>'size')::bigint desc nulls last
limit 100;

-- 4-1b. 고아 파일 합계 (얼마나 줄어들지 미리 보기)
with referenced_urls as (
  select photo_url as url from public.cats where photo_url is not null
  union all
  select unnest(photo_urls)   from public.cats where photo_urls is not null
  union all
  select photo_url from public.cat_comments where photo_url is not null
  union all
  select photo_url from public.care_logs    where photo_url is not null
),
referenced_names as (
  select regexp_replace(url, '^.*/cat-photos/', '') as obj_name
  from referenced_urls
  where url like '%/cat-photos/%'
)
select
  count(*)                                          as orphan_count,
  pg_size_pretty(sum((metadata->>'size')::bigint))  as orphan_total_size
from storage.objects
where bucket_id = 'cat-photos'
  and name not in (select obj_name from referenced_names);

-- 4-2. 위 결과 검토 후 — 정말 고아가 맞으면 삭제
-- with referenced_urls as (
--   select photo_url as url from public.cats where photo_url is not null
--   union all
--   select unnest(photo_urls)   from public.cats where photo_urls is not null
--   union all
--   select photo_url from public.cat_comments where photo_url is not null
--   union all
--   select photo_url from public.care_logs    where photo_url is not null
-- ),
-- referenced_names as (
--   select regexp_replace(url, '^.*/cat-photos/', '') as obj_name
--   from referenced_urls
--   where url like '%/cat-photos/%'
-- )
-- delete from storage.objects
-- where bucket_id = 'cat-photos'
--   and name not in (select obj_name from referenced_names);

-- 4-3. shorts 버킷 — DB에서 참조 안 되는 영상 찾기
select
  o.name,
  pg_size_pretty((o.metadata->>'size')::bigint) as size,
  o.created_at
from storage.objects o
where o.bucket_id = 'shorts'
  and not exists (
    select 1 from public.shorts s
    where s.video_url like '%/' || o.name
       or s.thumbnail_url like '%/' || o.name
  )
order by (o.metadata->>'size')::bigint desc nulls last;

-- 4-4. 다른 버킷도 같은 패턴으로 — 어떤 버킷이 있는지 1-2 결과 보고 결정


-- ══════════════════════════════════════════════════════════════
-- PART 5. (옵션) pg_cron으로 자동화 — 1회만 등록하면 끝
-- ══════════════════════════════════════════════════════════════
-- Supabase Pro부터 pg_cron extension 사용 가능.
-- Dashboard → Database → Extensions 에서 pg_cron 활성화 후 실행.

-- create extension if not exists pg_cron;

-- 매일 새벽 3시 — 오래된 로그 정리
-- select cron.schedule(
--   'storage-diet-daily',
--   '0 3 * * *',
--   $$
--     select public.cleanup_old_visit_dedupe();
--     delete from public.push_alert_log  where sent_at    < now() - interval '30 days';
--     delete from public.auth_error_logs where created_at < now() - interval '90 days';
--   $$
-- );

-- 등록된 cron 목록
-- select * from cron.job;

-- 해제하고 싶을 때
-- select cron.unschedule('storage-diet-daily');


-- ══════════════════════════════════════════════════════════════
-- PART 6. VACUUM — 실제 디스크 공간 회수
-- ══════════════════════════════════════════════════════════════
-- DELETE 만으로는 디스크 점유가 줄지 않음 (dead tuple 만 생김).
-- VACUUM 실행해야 OS 레벨에서 공간 반환.

-- 6-1. 가벼운 정리 (테이블 락 없음, 추천)
vacuum (analyze) public.push_alert_log;
vacuum (analyze) public.auth_error_logs;
vacuum (analyze) public.anon_visit_dedupe;

-- 6-2. 강력 회수 (테이블 락 — 새벽에 실행 권장)
-- ⚠ VACUUM FULL 동안 해당 테이블 읽기/쓰기 모두 막힘
-- vacuum full public.push_alert_log;
-- vacuum full public.auth_error_logs;
-- vacuum full public.anon_visit_dedupe;
-- vacuum full public.cats;  -- 더미 대량 삭제했을 때만

-- 6-3. 사용량 다시 확인 (Part 1-1, 1-4 다시 실행)


-- ══════════════════════════════════════════════════════════════
-- 메모
-- ══════════════════════════════════════════════════════════════
-- ❌ cat_location_history — UPDATE/DELETE 정책상 금지 (감사 로그)
--    오래되면 보관 정책 별도 결정 후 직접 삭제.
-- ❌ direct_messages — 사용자 메시지. 임의 삭제 금지.
-- ❌ posts / cat_comments — 콘텐츠. 임의 삭제 금지.
-- ✅ news.auto_imported = true 중 오래된 것은 필요시 수동 정리 가능.
--
-- Storage 버킷 차원에서 최대 절감:
--   - cat-photos 가 가장 큰 게 보통. Part 4-1 고아 파일 정리가 핵심.
--   - 사용자별 TOP (1-3 결과)에 비정상적으로 큰 유저가 있으면 어뷰징 의심.
-- ══════════════════════════════════════════════════════════════
