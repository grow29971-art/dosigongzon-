-- ══════════════════════════════════════════
-- 스트릭 프리즈(건너뛰기) 쿠폰
-- 목적: 유저가 1주에 1회 "오늘 돌봄 못 함"을 스트릭에 영향 없이 건너뛰기.
-- 룰:
--   · 같은 유저 + 같은 KST 날짜 중복 INSERT 불가 (UNIQUE)
--   · ISO 주간(월~일) 당 1회 제한은 app/함수에서 검사
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  freeze_date date not null,                -- KST 기준 얼린 날짜 (YYYY-MM-DD)
  created_at timestamptz not null default now()
);

-- 같은 유저가 같은 날짜를 두 번 얼리지 못하게
create unique index if not exists streak_freezes_user_date_uidx
  on public.streak_freezes(user_id, freeze_date);

-- 최근 조회 빠르게
create index if not exists streak_freezes_user_created_idx
  on public.streak_freezes(user_id, created_at desc);

alter table public.streak_freezes enable row level security;

-- SELECT: 본인 것만
drop policy if exists streak_freezes_select_own on public.streak_freezes;
create policy streak_freezes_select_own
  on public.streak_freezes
  for select
  using (user_id = auth.uid());

-- INSERT: 본인 이름으로만
drop policy if exists streak_freezes_insert_own on public.streak_freezes;
create policy streak_freezes_insert_own
  on public.streak_freezes
  for insert
  with check (user_id = auth.uid());

-- UPDATE/DELETE: 금지 (쿠폰 조작 방어)

-- ── 주간 사용 제약 확인 함수 ──
-- 이번 ISO 주간(월~일 KST)에 이미 쿠폰을 썼는지 확인.
create or replace function public.has_used_streak_freeze_this_week(p_user uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.streak_freezes
    where user_id = p_user
      and freeze_date >= (
        (current_date at time zone 'Asia/Seoul')::date
        - extract(isodow from (current_date at time zone 'Asia/Seoul'))::int + 1
      )
  );
$$;

-- ── 쿠폰 사용 RPC — 트랜잭션 내에서 주간 제약 + INSERT 원자적 처리 ──
create or replace function public.use_streak_freeze(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_week_start date;
  v_used boolean;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', '로그인이 필요합니다.');
  end if;

  -- KST 오늘/어제만 허용 (미래나 오래된 날짜 금지)
  if p_date > ((now() at time zone 'Asia/Seoul')::date) then
    return jsonb_build_object('ok', false, 'error', '미래 날짜는 얼릴 수 없어요.');
  end if;
  if p_date < ((now() at time zone 'Asia/Seoul')::date) - 1 then
    return jsonb_build_object('ok', false, 'error', '오늘/어제만 얼릴 수 있어요.');
  end if;

  -- 이번 주에 이미 썼는지
  v_week_start := ((now() at time zone 'Asia/Seoul')::date)
                  - extract(isodow from (now() at time zone 'Asia/Seoul'))::int + 1;

  select exists (
    select 1 from public.streak_freezes
    where user_id = v_user and freeze_date >= v_week_start
  ) into v_used;

  if v_used then
    return jsonb_build_object('ok', false, 'error', '이번 주에 이미 사용했어요.');
  end if;

  -- 중복 INSERT 방어는 UNIQUE 인덱스가 처리
  begin
    insert into public.streak_freezes(user_id, freeze_date) values (v_user, p_date);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', '해당 날짜는 이미 얼려져 있어요.');
  end;

  return jsonb_build_object('ok', true, 'freeze_date', p_date);
end;
$$;

grant execute on function public.use_streak_freeze(date) to authenticated;
grant execute on function public.has_used_streak_freeze_this_week(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
-- 끝.
