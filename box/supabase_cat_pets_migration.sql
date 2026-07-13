-- ══════════════════════════════════════════
-- 고양이 쓰다듬기 (pet) — 애정 카운터 (2026-07-13)
-- 지도에서 고양이 탭 → "쓰다듬기" 버튼 → 하트 팡 + 누적 횟수 증가.
-- 순수 애정 표현(포인트/코인 보상 없음)이라 카운터 부풀려도 무해 —
-- 그래도 로그인 필수 + 호출당 상한(30)으로 남용 완화.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.cats add column if not exists pet_count bigint not null default 0;

-- 쓰다듬기 RPC — p_count만큼 누적(연타를 배치 flush). 로그인 필수, 1회 최대 30.
create or replace function public.pet_cat(p_cat_id uuid, p_count integer)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_new bigint;
begin
  if auth.uid() is null then return null; end if;      -- 로그인 필수
  if p_count is null or p_count < 1 then return null; end if;
  if p_count > 30 then p_count := 30; end if;           -- 1회 호출 상한
  update cats set pet_count = pet_count + p_count
    where id = p_cat_id
    returning pet_count into v_new;
  return v_new;
end $$;

revoke execute on function public.pet_cat(uuid, integer) from public, anon;
grant execute on function public.pet_cat(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

-- ── 롤백 ──
-- drop function if exists public.pet_cat(uuid, integer);
-- alter table public.cats drop column if exists pet_count;
