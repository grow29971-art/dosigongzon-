-- ══════════════════════════════════════════
-- 후원금 수동 조정 (2026-08-25)
-- 배경: "모인 금액"은 주문 후원액 자동 집계인데, 오프라인 후원 입금·정정·이월 같은
--   앱 밖의 돈은 반영 수단이 없었다. 관리자가 증액(+)/감액(−)을 사유와 함께 기록하면
--   집계(lib/fund-settlement.ts)가 모인 금액에 합산한다.
-- 원칙: 스냅샷 숫자를 직접 덮어쓰지 않는다 — 조정도 한 건씩 사유가 남는 장부여야
--   투명 정산 취지가 유지된다. 수정(update)은 없음: 정정은 삭제 후 재등록.
--
-- 읽기/쓰기: 관리자만 (RLS). 집계는 service_role이라 정책 무관.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.fund_adjustments (
  id         uuid primary key default gen_random_uuid(),
  amount     integer not null check (amount <> 0), -- 양수=증액, 음수=감액
  memo       text not null,                        -- 사유 (예: 오프라인 후원 입금, 집계 정정)
  created_at timestamptz not null default now()
);

create index if not exists fund_adjustments_created_idx
  on public.fund_adjustments (created_at desc);

alter table public.fund_adjustments enable row level security;

drop policy if exists fund_adjustments_admin_select on public.fund_adjustments;
create policy fund_adjustments_admin_select on public.fund_adjustments
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists fund_adjustments_admin_insert on public.fund_adjustments;
create policy fund_adjustments_admin_insert on public.fund_adjustments
  for insert with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists fund_adjustments_admin_delete on public.fund_adjustments;
create policy fund_adjustments_admin_delete on public.fund_adjustments
  for delete using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증 (실행 후):
--   1) 관리자 로그인 상태에서 /admin/fund 조정 등록 → 모인 금액에 합산되는지
--   2) anon으로 GET /rest/v1/fund_adjustments → [] (비노출)
-- 롤백 (되돌릴 때만):
--   drop table public.fund_adjustments;
--   (집계 코드는 테이블이 없으면 조용히 건너뛰므로 코드 롤백 없이도 동작)
-- ══════════════════════════════════════════
-- 끝.
