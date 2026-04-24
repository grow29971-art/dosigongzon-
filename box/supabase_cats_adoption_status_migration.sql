-- ══════════════════════════════════════════
-- 고양이 입양·임시보호 매칭 상태 (2026-04-24)
-- cats 테이블에 adoption_status 컬럼 추가.
-- 값: 'seeking_home' | 'temp_care' | 'both' | null
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

alter table public.cats
  add column if not exists adoption_status text
  check (adoption_status in ('seeking_home', 'temp_care', 'both') or adoption_status is null);

-- 인덱스: "입양 가능한 고양이만" 필터 쿼리 최적화
-- WHERE adoption_status IS NOT NULL AND hidden = false 같은 쿼리 패턴
create index if not exists cats_adoption_status_idx
  on public.cats (adoption_status)
  where adoption_status is not null and hidden = false;

comment on column public.cats.adoption_status is
  '입양·임보 매칭 상태. seeking_home=입양처 찾는 중, temp_care=임시보호 필요, both=둘 다, null=해당 없음';

notify pgrst, 'reload schema';
-- 끝.
