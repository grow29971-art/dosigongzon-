-- ══════════════════════════════════════════
-- 도시공존 — 코드 감사 후속 SQL 2탄 (2026-07-16)
-- 감사 발견 C1·C4·M7 패치. (C3은 supabase_game_columns_guard_migration.sql 참조)
-- 실행 위치: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ── C1. buy_shop_item_atomic 클라이언트 직접 호출 차단 ──
-- security definer 함수가 authenticated에 열려 있고 p_user_id·p_price를 그대로
-- 신뢰함 → 유저가 POST /rest/v1/rpc/buy_shop_item_atomic 에 p_price를 음수로
-- 넣으면 coins = coins - (-N) 무한 코인 발행, 타인 p_user_id로 강제 소진도 가능.
-- 서버 라우트(/api/shop/buy)는 service_role로 호출하므로 기능 영향 없음.
revoke execute on function public.buy_shop_item_atomic(uuid, text, int) from public, anon, authenticated;
grant execute on function public.buy_shop_item_atomic(uuid, text, int) to service_role;

-- ── C4-a. 카드 레벨 커브 단일화 ──
-- 기존 SQL 커브(50/120/220/350/520/730/990/1300/1670)와 서버 코드 커브
-- (90/210/380/610/900/1260/1690/2200/2800 — care·checkin·battle 라우트, lib/care.ts)가
-- 달라서 돌봄 EXP 적립과 급여/배틀 레벨 계산이 서로 레벨을 되돌리는 문제.
-- 코드 쪽 커브로 통일.
create or replace function public.compute_cat_card_level(p_exp int)
returns int as $$
  select case
    when p_exp >= 2800 then 10
    when p_exp >= 2200 then 9
    when p_exp >= 1690 then 8
    when p_exp >= 1260 then 7
    when p_exp >= 900  then 6
    when p_exp >= 610  then 5
    when p_exp >= 380  then 4
    when p_exp >= 210  then 3
    when p_exp >= 90   then 2
    else 1
  end;
$$ language sql immutable;

-- ── C4-b. add_cat_card_exp — 클라이언트 지정 EXP 주입 차단 ──
-- p_amount에 상한이 없어 p_amount:99999로 즉시 만렙, 음수로 EXP 깎기 가능했음.
-- 시그니처는 유지(기존 배포 클라이언트가 p_amount:10으로 호출 중)하되 값은 무시하고
-- 서버 고정값 10만 지급. 커브 변경으로 인한 레벨 하락은 greatest로 방지(하향 없음).
create or replace function public.add_cat_card_exp(p_cat_id uuid, p_amount int default 10)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_fixed    int  := 10; -- p_amount는 신뢰하지 않음 — 돌봄 1회 = 10 XP 고정
  v_prev_exp int;
  v_new_exp  int;
  v_prev_lvl int;
  v_new_lvl  int;
begin
  if v_uid is null then
    return '{"ok":false,"error":"unauthorized"}'::json;
  end if;

  -- 해당 고양이에 최근 2분 내 내 care_log가 있는지 확인 (어뷰징 방지)
  if not exists (
    select 1 from care_logs
    where cat_id = p_cat_id
      and author_id = v_uid
      and created_at > now() - interval '2 minutes'
  ) then
    return '{"ok":false,"error":"no_recent_log"}'::json;
  end if;

  select card_exp, card_level into v_prev_exp, v_prev_lvl
  from cats where id = p_cat_id and card_generated_at is not null
  for update;

  if not found then
    return '{"ok":false,"error":"no_card"}'::json;
  end if;

  if v_prev_lvl >= 10 then
    return json_build_object('ok', true, 'level', 10, 'exp', v_prev_exp, 'leveled_up', false);
  end if;

  v_new_exp := v_prev_exp + v_fixed;
  v_new_lvl := greatest(v_prev_lvl, compute_cat_card_level(v_new_exp));

  update cats
  set card_exp = v_new_exp, card_level = v_new_lvl
  where id = p_cat_id;

  return json_build_object(
    'ok',         true,
    'level',      v_new_lvl,
    'exp',        v_new_exp,
    'prev_level', v_prev_lvl,
    'leveled_up', v_new_lvl > v_prev_lvl
  );
end;
$$;

-- ── M7. streak_freezes 직접 INSERT 차단 ──
-- INSERT 정책이 열려 있어 클라이언트가 RPC의 주1회 제약을 우회해 임의 날짜의
-- 프리즈를 직접 삽입 → 스트릭 무한 조작 가능했음. 쿠폰 사용은 security definer
-- RPC가 담당하므로 직접 INSERT 정책은 불필요.
drop policy if exists streak_freezes_insert_own on public.streak_freezes;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────
-- 롤백 (원복 시)
-- C1: grant execute on function public.buy_shop_item_atomic(uuid, text, int) to authenticated;
-- C4: box/supabase_card_leveling_migration.sql 원본을 다시 실행 (구 커브·p_amount 신뢰 버전)
-- M7: create policy streak_freezes_insert_own on public.streak_freezes
--       for insert with check (user_id = auth.uid());
-- ─────────────────────────────────────────────
