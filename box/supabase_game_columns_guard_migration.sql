-- ══════════════════════════════════════════
-- 도시공존 — 게임 경제 컬럼 직접 조작 차단 (2026-07-16 보안 감사 #1·#2)
-- 발견: profiles_update_own / cats_update_own RLS가 "본인 행" UPDATE를 허용하는데
--   PostgreSQL RLS는 행 단위라, 유저가 anon key + 본인 JWT로 Supabase REST를
--   직접 호출하면(PATCH /rest/v1/profiles?id=eq.본인) coins·전적·보상 날짜 등
--   게임 경제 컬럼을 임의 값으로 쓸 수 있음 → 무한 코인·리더보드 조작.
-- 해결: BEFORE UPDATE 트리거로 비-admin 유저의 게임 컬럼 변경을 차단.
--   auth.uid()가 NULL인 요청(service_role — 서버 API·크론)은 통과.
-- 실행 위치: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- ⚠⚠ 실행 순서: box/supabase_care_migration.sql 을 먼저 실행할 것!
--    (아래 cats 트리거가 fed_at 등 케어 컬럼을 참조 — 컬럼이 없으면
--     트리거 생성은 되지만 이후 모든 cats UPDATE가 런타임 에러남)
-- ══════════════════════════════════════════

-- ① profiles — 기존 profiles_guard_protected_fields 함수 교체(v3):
--    기존 보호(admin_title/invite_code/invited_by/id/suspended) 유지 +
--    게임 경제 컬럼 추가 + service_role(NULL uid) 통과 명시.
create or replace function public.profiles_guard_protected_fields()
returns trigger
language plpgsql
as $$
begin
  -- service_role(서버 API·크론)은 uid가 없음 — 서버 로직만 경제 컬럼을 만진다
  if auth.uid() is null then
    return new;
  end if;

  -- admin이 update하는 경우는 통과 (관리 작업)
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    return new;
  end if;

  -- 일반 유저는 보호 필드 변경 차단 (기존)
  if new.admin_title is distinct from old.admin_title then
    raise exception '권한 없음: admin_title 변경 불가';
  end if;
  if new.invite_code is distinct from old.invite_code then
    raise exception '권한 없음: invite_code 변경 불가';
  end if;
  if new.invited_by is distinct from old.invited_by then
    raise exception '권한 없음: invited_by 변경 불가';
  end if;
  if new.id is distinct from old.id then
    raise exception '권한 없음: id 변경 불가';
  end if;
  if new.suspended is distinct from old.suspended then
    raise exception '권한 없음: suspended 변경 불가 (admin 전용)';
  end if;

  -- ★ 신규(2026-07-16): 게임 경제·보상 상태 컬럼 — 서버(service_role)만 변경 가능
  if new.coins is distinct from old.coins then
    raise exception '권한 없음: coins는 서버만 변경 가능';
  end if;
  if new.boss_defeats is distinct from old.boss_defeats
     or new.best_win_streak is distinct from old.best_win_streak
     or new.perfect_catch_count is distinct from old.perfect_catch_count then
    raise exception '권한 없음: 전적 컬럼은 서버만 변경 가능';
  end if;
  if new.last_login_bonus_date is distinct from old.last_login_bonus_date
     or new.last_care_coin_date is distinct from old.last_care_coin_date
     or new.care_coin_count_today is distinct from old.care_coin_count_today
     or new.last_checkin_date is distinct from old.last_checkin_date then
    raise exception '권한 없음: 보상 지급 상태는 서버만 변경 가능';
  end if;
  if new.pve_seen_keys is distinct from old.pve_seen_keys
     or new.pve_defeated_keys is distinct from old.pve_defeated_keys then
    raise exception '권한 없음: PVE 도감은 서버만 변경 가능';
  end if;

  return new;
end;
$$;

-- 트리거 재바인딩 (기존과 동일 이름 — 함수 교체만으로 충분하지만 명시적으로)
drop trigger if exists profiles_guard_protected_fields_trg on public.profiles;
create trigger profiles_guard_protected_fields_trg
  before update on public.profiles
  for each row
  execute function public.profiles_guard_protected_fields();

-- ② cats — 게임 진행 컬럼 가드 신설.
--    유저가 본인 고양이 행을 REST로 직접 PATCH해 만렙·무한연승 설정하는 것 차단.
--    (프로필 편집: 이름·설명·사진 등은 그대로 허용 / 케어·배틀 API는 service_role이라 통과)
create or replace function public.cats_guard_progress_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new; -- service_role (케어·배틀·출석 API, 크론)
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
     or new.pet_day is distinct from old.pet_day then
    raise exception '권한 없음: 케어 상태는 서버만 변경 가능';
  end if;

  return new;
end;
$$;

drop trigger if exists cats_guard_progress_fields_trg on public.cats;
create trigger cats_guard_progress_fields_trg
  before update on public.cats
  for each row
  execute function public.cats_guard_progress_fields();

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────
-- 롤백 (원복 시 아래 실행)
-- ① profiles: box/supabase_security_hotfix_20260519.sql 의
--    profiles_guard_protected_fields(v2, 경제 컬럼 가드 없음)를 다시 실행.
--    (주의: v2에는 service_role NULL-uid 통과가 없음 — 기존 동작 그대로)
-- ② cats:
-- drop trigger if exists cats_guard_progress_fields_trg on public.cats;
-- drop function if exists public.cats_guard_progress_fields();
-- ─────────────────────────────────────────────
