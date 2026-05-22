-- ══════════════════════════════════════════
-- 도시공존 — "초기 200 케어테이커" 한정 타이틀 이벤트
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
-- 적용 일자: 2026-05-22 (D-3, 정식 출시 5/25 직전)
-- ══════════════════════════════════════════
-- 대상: 현재까지 가입한 모든 사용자(약 205명) — 영구 한정 타이틀 og_200 부여.
-- 정식 출시 후엔 og_200 가입 경로 없음 → 영구 희소성.
--
-- 정책:
--  - 기존 admin_title이 NULL인 사람: og_200 부여
--  - 기존 admin_title이 'early_supporter' (1~100번): og_200 부여(더 영예로 덮어쓰기)
--  - 기존 admin_title이 'founding_member': og_200 부여(둘 다 출시 전 가입이라 더 영예 우선)
--  - 그 외 수동 부여된 official_volunteer·tnr_expert 등: 그대로 보존 (운영자가 의도해서 부여한 것)
--
-- 검증 (실행 후):
--   select count(*) from public.profiles where admin_title = 'og_200';
--   → 205 또는 그 근처 (현재 가입자 수)
-- ══════════════════════════════════════════

-- profiles_guard_protected_fields trigger가 admin_title 변경 차단.
-- SQL Editor는 auth.uid()=NULL이라 admin 분기 통과 못 함 → 일시 disable로 우회.
-- 정책 변경 없이 마이그레이션 한 트랜잭션 동안만 비활성.
alter table public.profiles disable trigger profiles_guard_protected_fields_trg;

-- og_200 부여 (NULL · early_supporter · founding_member만 덮어쓰기)
update public.profiles
set admin_title = 'og_200'
where admin_title is null
   or admin_title = 'early_supporter'
   or admin_title = 'founding_member';

-- trigger 즉시 재활성 — 정책 영구 손상 방지
alter table public.profiles enable trigger profiles_guard_protected_fields_trg;

-- 결과 확인용 (실행 후 자동 표시)
select
  admin_title,
  count(*) as cnt
from public.profiles
group by admin_title
order by cnt desc;

-- PostgREST 스키마 캐시 리로드 (admin_title 값 변화)
notify pgrst, 'reload schema';

-- 끝.
