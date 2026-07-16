-- ══════════════════════════════════════════
-- 다마고치 케어 확장 — 청결 게이지 (2026-07-16 씬 리디자인)
-- 대상: cats. lazy decay 유지(크론 0) — cleaned_at 타임스탬프 하나만 추가.
-- 청결도 = cleanedAt에서 36h 선형 감쇠(lib/care.ts cleanlinessAt). 청소 액션 = cleaned_at=now.
-- 실행 위치: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ⚠ 선행: supabase_care_migration.sql(fed_at 등) + supabase_game_columns_guard_migration.sql
--         이 먼저 실행돼 있어야 함(아래 ②가 기존 cats 가드 함수를 교체함).
-- ══════════════════════════════════════════

-- ① 청결 기준 타임스탬프 컬럼
alter table public.cats add column if not exists cleaned_at timestamptz; -- 청결 100 기준점(gaugeTs 역산값)

-- ② cats 가드 트리거에 cleaned_at 추가 — 실 유저가 REST로 직접 청결을 조작 못 하게.
--    (supabase_game_columns_guard_migration.sql의 함수를 cleaned_at 포함해 재정의)
create or replace function public.cats_guard_progress_fields()
returns trigger
language plpgsql
as $$
begin
  -- 직접 REST 요청만 검사 — service_role·SECURITY DEFINER RPC(add_cat_card_exp 등)는 통과
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    return new;
  end if;

  if new.card_exp is distinct from old.card_exp
     or new.card_level is distinct from old.card_level then
    raise exception '권한 없음: 카드 경험치/레벨은 서버만 변경 가능';
  end if;
  if new.win_streak is distinct from old.win_streak
     or new.best_win_streak is distinct from old.best_win_streak
     or new.pve_win_count is distinct from old.pve_win_count
     or new.pvp_wins is distinct from old.pvp_wins
     or new.pvp_losses is distinct from old.pvp_losses
     or new.pvp_draws is distinct from old.pvp_draws then
    raise exception '권한 없음: 전적 컬럼은 서버만 변경 가능';
  end if;
  if new.fed_at is distinct from old.fed_at
     or new.mood_at is distinct from old.mood_at
     or new.fed_day is distinct from old.fed_day
     or new.fed_today is distinct from old.fed_today
     or new.pet_day is distinct from old.pet_day
     or new.cleaned_at is distinct from old.cleaned_at then
    raise exception '권한 없음: 케어 상태는 서버만 변경 가능';
  end if;

  return new;
end;
$$;

-- 트리거는 이미 바인딩돼 있음(함수만 교체). 없으면 아래 주석 해제:
-- drop trigger if exists cats_guard_progress_fields_trg on public.cats;
-- create trigger cats_guard_progress_fields_trg before update on public.cats
--   for each row execute function public.cats_guard_progress_fields();

notify pgrst, 'reload schema';

-- 검증: select cleaned_at from public.cats limit 1;  → 42703 안 나면 성공.
-- API는 마이그레이션 전이면 cleaned_at 누락을 감지해 청결 없이 동작(밥·쓰담은 정상).

-- ── 롤백 ──
-- alter table public.cats drop column if exists cleaned_at;
-- (가드 함수는 supabase_game_columns_guard_migration.sql 원본을 다시 실행해 cleaned_at 절 제거)
