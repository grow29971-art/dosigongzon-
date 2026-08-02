-- ══════════════════════════════════════════
-- STEP 4 — AI 카드생성 글로벌 일일 서킷브레이커 (2026-08-03)
-- 실행 위치: Supabase Dashboard → SQL Editor   ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
--
-- 【배경】 generate-card는 유저당 분당 20 인메모리 리밋뿐 → 다중 인스턴스에서 ×N.
--   플랫폼 전체 Gemini 호출 총량 상한이 없어, 유료 전환 시 비용폭탄 여지.
--   (무료 티어면 최악은 비용이 아니라 "랜덤 카드 폴백"=가용성. 유료 전환 시 진짜 캡.)
--
-- 【동작】 플랫폼 일일 상한(기본 5000콜) 도달 시 Gemini 호출을 건너뛰고 라우트가
--   기존 makeRandomCard 폴백으로 "우아하게 강등"(에러 아님, 카드는 정상 발급).
--   fail-open: 라우트가 RPC 미배포/오류면 기존대로 AI 진행 → SQL·배포 순서 독립.
--
-- 【보안 규율 (2026-08-02 보안 패널 — 방금 definer 뷰 사고 낸 프로젝트라 특히)】
--   ▸ RPC는 service_role 전용(anon/authenticated REVOKE) — 아니면 누구나 루프로
--     카운터를 소진해 전 유저를 강등시키는 DoS가 된다.
--   ▸ security definer + search_path 고정.  ▸ 테이블 RLS enable + 정책 0(서비스롤만).
-- ══════════════════════════════════════════

create table if not exists public.ai_usage_counter (
  usage_date date primary key,
  count      int  not null default 0
);

alter table public.ai_usage_counter enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가. service_role만 RLS 우회.

-- 원자적 check+increment. 상한 도달 시 update가 WHERE로 스킵돼 RETURNING 0행 → false.
create or replace function public.increment_ai_call(
  p_limit int,
  p_date  date default ((now() at time zone 'Asia/Seoul')::date)   -- KST 자정 리셋
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.ai_usage_counter (usage_date, count)
    values (p_date, 1)
    on conflict (usage_date) do update
      set count = public.ai_usage_counter.count + 1
      where public.ai_usage_counter.count < p_limit
    returning count into v_count;
  -- v_count is null ⇔ 상한 도달로 update 스킵 ⇔ 허용 안 함
  return v_count is not null;
end $$;

revoke all on function public.increment_ai_call(int, date) from public, anon, authenticated;
grant execute on function public.increment_ai_call(int, date) to service_role;

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   select public.increment_ai_call(3);  -- true
--   select public.increment_ai_call(3);  -- true
--   select public.increment_ai_call(3);  -- true
--   select public.increment_ai_call(3);  -- false (상한 3 도달)
--   select * from public.ai_usage_counter;  -- 오늘 count=3
--   (익명/로그인 롤로 rpc 호출 시 권한 거부여야 정상)

-- ── ROLLBACK ──
-- drop function if exists public.increment_ai_call(int, date);
-- drop table if exists public.ai_usage_counter;
