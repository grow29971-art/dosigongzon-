-- ══════════════════════════════════════════
-- 친구 초대 코드 시스템 마이그레이션
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF, 상단에서부터 차례로 실행
-- ══════════════════════════════════════════

-- 1. profiles 컬럼 추가
alter table public.profiles
  add column if not exists invite_code text unique,
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_invite_code_idx on public.profiles (invite_code);
create index if not exists profiles_invited_by_idx on public.profiles (invited_by);

-- 2. invite_code 생성 함수 (6자, 혼동되는 문자 제외)
create or replace function generate_invite_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
  attempt int;
  cnt int;
begin
  for attempt in 1..15 loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    select count(*) into cnt from public.profiles where invite_code = code;
    if cnt = 0 then
      return code;
    end if;
  end loop;
  -- 충돌 계속되면 UUID 일부로 fallback
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$ language plpgsql security definer;

-- 3. 기존 유저에게 invite_code 일괄 부여
update public.profiles
set invite_code = generate_invite_code()
where invite_code is null;

-- 4. 초대 이벤트 로그 테이블
create table if not exists public.invite_events (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  invite_code text,
  created_at timestamptz not null default now(),
  unique (invitee_id)
);

create index if not exists invite_events_inviter_idx on public.invite_events (inviter_id, created_at desc);

-- 5. RLS
alter table public.invite_events enable row level security;

-- 본인이 초대한 이벤트만 조회 가능 (초대 실적 확인용)
drop policy if exists "invite_events_read_own" on public.invite_events;
create policy "invite_events_read_own" on public.invite_events
  for select using (auth.uid() = inviter_id);

-- 본인이 invitee로 찍힌 이벤트도 조회 가능 (초대받은 상태 확인용)
drop policy if exists "invite_events_read_invitee" on public.invite_events;
create policy "invite_events_read_invitee" on public.invite_events
  for select using (auth.uid() = invitee_id);

-- INSERT 정책: 본인이 invitee인 경우에만, 그리고 아직 자기 invited_by 가 null일 때 (중복/덮어쓰기 방지는 별도 보장)
drop policy if exists "invite_events_insert_self" on public.invite_events;
create policy "invite_events_insert_self" on public.invite_events
  for insert with check (
    auth.uid() = invitee_id
    and inviter_id <> auth.uid()  -- 자기 자신을 초대자로 설정 불가
  );

-- UPDATE/DELETE 금지 (기록 보존)

-- 6. 초대 적용 RPC (원자적: invited_by 업데이트 + invite_events insert)
-- 클라이언트는 invite_code 만 전달하면 됨. 서버가 inviter_id 조회 + 검증.
create or replace function apply_invite_code(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inviter_id uuid;
  v_existing_invited_by uuid;
  v_normalized_code text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_normalized_code := upper(trim(p_invite_code));
  if v_normalized_code is null or length(v_normalized_code) < 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code_format');
  end if;

  -- 현재 프로필 상태
  select invited_by into v_existing_invited_by
  from public.profiles
  where id = v_user_id;

  if v_existing_invited_by is not null then
    return jsonb_build_object('ok', false, 'error', 'already_invited');
  end if;

  -- 초대자 찾기
  select id into v_inviter_id
  from public.profiles
  where invite_code = v_normalized_code;

  if v_inviter_id is null then
    return jsonb_build_object('ok', false, 'error', 'code_not_found');
  end if;

  if v_inviter_id = v_user_id then
    return jsonb_build_object('ok', false, 'error', 'self_invite_forbidden');
  end if;

  -- 원자적 적용
  update public.profiles
  set invited_by = v_inviter_id
  where id = v_user_id
    and invited_by is null;

  insert into public.invite_events (inviter_id, invitee_id, invite_code)
  values (v_inviter_id, v_user_id, v_normalized_code)
  on conflict (invitee_id) do nothing;

  return jsonb_build_object('ok', true, 'inviter_id', v_inviter_id);
end;
$$;

grant execute on function apply_invite_code(text) to authenticated;

-- 7. 내 초대 실적 요약 조회용 view
create or replace view public.my_invite_stats as
select
  p.id as user_id,
  p.invite_code,
  coalesce(cnt.n, 0) as invited_count
from public.profiles p
left join (
  select inviter_id, count(*) as n
  from public.invite_events
  group by inviter_id
) cnt on cnt.inviter_id = p.id;

-- 뷰 권한 (본인 row만 볼 수 있도록 cell 보안은 profiles 정책에 의존)
grant select on public.my_invite_stats to authenticated;

NOTIFY pgrst, 'reload schema';
-- 끝.
