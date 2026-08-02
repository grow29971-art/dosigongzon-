-- ══════════════════════════════════════════
-- STEP 1 진짜 구멍 수정 — add_cat_card_exp "로그 소비" 처리 (2026-08-03)
-- 실행 위치: Supabase Dashboard → SQL Editor   ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
--
-- 【문제 (2026-08-02 보안수정 회의: 프로파일러·보안 동시지목)】
--   add_cat_card_exp(security definer, authenticated 호출 가능)는 "최근 2분 내 내
--   care_log가 존재하는가"만 확인하고, 그 로그가 이미 EXP에 쓰였는지는 안 본다.
--   → 진짜 care_log 1건만 만들어두고 `supabase.rpc("add_cat_card_exp",{p_cat_id})`를
--     직접 100번 연타하면 +1000 EXP. 몇 분이면 카드 만렙. 사진 게이트·쿨다운을
--     아무리 얹어도 이 RPC가 그 위를 그냥 넘어간다 → 이게 STEP 1의 1순위.
--
-- 【수정】 care_logs에 `card_exp_awarded_at` 컬럼 추가. RPC는 "존재 확인"이 아니라
--   아직 EXP에 안 쓰인 최근 로그 1건을 원자적으로 선점(FOR UPDATE SKIP LOCKED)해
--   `card_exp_awarded_at`을 찍고 소비한다. 로그 1건 = EXP 정확히 1회.
--   정상 흐름(createCareLog가 insert 직후 1회 호출)은 그대로 10 XP 지급 — 무영향.
--   기존 로그는 10분 창 밖이라 소급 지급 안 됨. 시그니처 불변(클라 재배포 불필요).
-- ══════════════════════════════════════════

-- 1) 소비 표시 컬럼 (idempotent)
alter table public.care_logs
  add column if not exists card_exp_awarded_at timestamptz;

-- 2) 미소비 로그 선점용 부분 인덱스
create index if not exists care_logs_unawarded_idx
  on public.care_logs (cat_id, author_id, created_at desc)
  where card_exp_awarded_at is null;

-- 3) RPC 교체 — 존재확인 → 원자적 소비
create or replace function public.add_cat_card_exp(p_cat_id uuid, p_amount int default 10)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_fixed    int  := 10;   -- p_amount는 신뢰하지 않음 — 돌봄 1회 = 10 XP 고정
  v_log_id   uuid;
  v_prev_exp int;
  v_new_exp  int;
  v_prev_lvl int;
  v_new_lvl  int;
begin
  if v_uid is null then
    return '{"ok":false,"error":"unauthorized"}'::json;
  end if;

  -- 아직 EXP에 안 쓰인 "내" 최근 care_log 1건을 원자적으로 선점·소비.
  -- 동일 로그로 두 번째 호출은 여기서 0행 → no_recent_log. (RPC 연타 무력화)
  update care_logs cl
  set card_exp_awarded_at = now()
  where cl.id = (
    select id from care_logs
    where cat_id = p_cat_id
      and author_id = v_uid
      and card_exp_awarded_at is null
      and created_at > now() - interval '10 minutes'
    order by created_at desc
    for update skip locked
    limit 1
  )
  returning cl.id into v_log_id;

  if not found then
    return '{"ok":false,"error":"no_recent_log"}'::json;
  end if;

  select card_exp, card_level into v_prev_exp, v_prev_lvl
  from cats where id = p_cat_id and card_generated_at is not null
  for update;

  if not found then
    -- 카드 미생성이면 소비한 로그를 되돌린다(EXP 못 줬으니 소비도 무효)
    update care_logs set card_exp_awarded_at = null where id = v_log_id;
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

NOTIFY pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증 (실행 후, 비관리자 JWT 권장)
--  1) 돌봄 기록 1건 남긴다 → add_cat_card_exp 1회: ok=true, exp +10
--  2) 같은 상태로 add_cat_card_exp 재호출: ok=false, error=no_recent_log (연타 차단됨)
--  3) 새 돌봄 기록 → 다시 1회만 ok=true
--
-- ROLLBACK (되돌리기 — 취약 상태로 복귀, 권장 안 함)
-- ------------------------------------------------------------
-- 함수를 "존재 확인" 버전으로 복원: box/supabase_security_audit_20260716_2_migration.sql
--   :40-95 의 add_cat_card_exp 정의를 create or replace 로 다시 실행.
-- drop index if exists public.care_logs_unawarded_idx;
-- alter table public.care_logs drop column if exists card_exp_awarded_at;
-- ══════════════════════════════════════════
