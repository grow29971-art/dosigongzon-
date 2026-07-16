-- 도시공존 — 코인 지급 트랜잭션화 (2026-07-16)
-- 문제: checkin/complete · coins/daily-login · coins/care-bonus 가 전부
--   "코인 조회 → JS에서 더하기 → update coins = 계산값" (read-modify-write).
--   동시에 다른 경로(배틀 보상, 상점 구매 등)가 코인을 바꾸면 한쪽 갱신이 소실됨.
-- 해결: 증감을 DB 안에서 원자적으로 처리하는 RPC 2종.
--   코드는 RPC가 없으면(42883/PGRST202) 기존 read-modify-write로 폴백하므로
--   이 SQL 실행 전에도 앱은 깨지지 않음.

-- ① 코인 원자 증감 — coins = coins + N 을 DB에서 한 방에.
--    p_amount는 서버가 정하는 값이라 클라이언트 직접 호출은 차단(공짜 코인 방지).
create or replace function public.increment_coins(p_user_id uuid, p_amount int)
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
     set coins = greatest(0, coalesce(coins, 0) + p_amount)
   where id = p_user_id
  returning coins;
$$;

revoke execute on function public.increment_coins(uuid, int) from public, anon, authenticated;
grant execute on function public.increment_coins(uuid, int) to service_role;

-- ② 돌봄 코인 보너스 원자 지급 — FOR UPDATE로 프로필 행을 잠그고
--    일일 카운터 검증·증가·코인 지급을 한 트랜잭션에서 처리.
--    (기존엔 동시 요청 둘 다 count_today=0을 읽고 이중 지급 가능했음)
create or replace function public.award_care_bonus_atomic(
  p_user_id uuid,
  p_amount int,
  p_today text,
  p_cap int,
  p_eligible int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coins int;
  v_date text;
  v_count int;
begin
  select coins, last_care_coin_date, care_coin_count_today
    into v_coins, v_date, v_count
    from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  if v_date is distinct from p_today then
    v_count := 0;
  else
    v_count := coalesce(v_count, 0);
  end if;

  if v_count >= p_cap then
    return jsonb_build_object('awarded', false, 'reason', 'daily_cap_reached', 'coins', coalesce(v_coins, 0));
  end if;
  if p_eligible <= v_count then
    return jsonb_build_object('awarded', false, 'reason', 'no_new_care_log', 'coins', coalesce(v_coins, 0));
  end if;

  update public.profiles
     set coins = coalesce(coins, 0) + p_amount,
         last_care_coin_date = p_today,
         care_coin_count_today = v_count + 1
   where id = p_user_id;

  return jsonb_build_object('awarded', true, 'coins', coalesce(v_coins, 0) + p_amount, 'count_today', v_count + 1);
end;
$$;

revoke execute on function public.award_care_bonus_atomic(uuid, int, text, int, int) from public, anon, authenticated;
grant execute on function public.award_care_bonus_atomic(uuid, int, text, int, int) to service_role;

-- ─────────────────────────────────────────────
-- 롤백 (원복 시 아래 실행 — 코드는 자동으로 기존 read-modify-write 폴백 사용)
-- drop function if exists public.increment_coins(uuid, int);
-- drop function if exists public.award_care_bonus_atomic(uuid, int, text, int, int);
-- ─────────────────────────────────────────────
