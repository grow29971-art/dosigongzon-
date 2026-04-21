-- 고양이 위치 변경 이력 테이블
-- 목적: 등록자가 고양이 위치를 옮길 때마다 변경 이력 보관 (어뷰징 감지·복원용)

create table if not exists public.cat_location_history (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,                -- 변경 시점의 닉네임 스냅샷
  old_lat numeric(10, 6) not null,
  old_lng numeric(10, 6) not null,
  old_region text,
  new_lat numeric(10, 6) not null,
  new_lng numeric(10, 6) not null,
  new_region text,
  distance_m numeric,                  -- 이동 거리(m). 편의상 client/trigger에서 계산
  created_at timestamptz not null default now()
);

create index if not exists cat_location_history_cat_idx
  on public.cat_location_history(cat_id, created_at desc);
create index if not exists cat_location_history_changed_by_idx
  on public.cat_location_history(changed_by, created_at desc);
create index if not exists cat_location_history_created_idx
  on public.cat_location_history(created_at desc);

alter table public.cat_location_history enable row level security;

-- SELECT: admin 전체, 본인(변경자) 자기 이력, caretaker 본인 고양이 이력
drop policy if exists cat_location_history_select on public.cat_location_history;
create policy cat_location_history_select
  on public.cat_location_history
  for select
  using (
    exists (
      select 1 from public.admins a
      where a.user_id = auth.uid()
    )
    or changed_by = auth.uid()
    or exists (
      select 1 from public.cats c
      where c.id = cat_location_history.cat_id
        and c.caretaker_id = auth.uid()
    )
  );

-- INSERT: 본인이 자기 이름으로만 기록 가능 (또는 service_role)
drop policy if exists cat_location_history_insert on public.cat_location_history;
create policy cat_location_history_insert
  on public.cat_location_history
  for insert
  with check (
    changed_by = auth.uid()
    or auth.role() = 'service_role'
  );

-- UPDATE/DELETE: 금지 (admin도 불가 — 감사 로그 무결성)
-- 정책 미정의 → 거부됨

-- 좌표 간 거리(m) 계산 함수 (Haversine)
create or replace function public.calc_distance_m(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) returns numeric
language plpgsql
immutable
as $$
declare
  r numeric := 6371000;  -- 지구 반지름(m)
  dlat numeric;
  dlng numeric;
  a numeric;
begin
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2) * sin(dlat/2)
       + cos(radians(lat1)) * cos(radians(lat2))
       * sin(dlng/2) * sin(dlng/2);
  return round((r * 2 * atan2(sqrt(a), sqrt(1 - a)))::numeric, 1);
end;
$$;

-- cats 테이블 UPDATE 시 좌표가 바뀌면 자동으로 이력 INSERT
create or replace function public.log_cat_location_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
begin
  -- 좌표가 실제로 바뀌지 않았으면 skip
  if NEW.lat is not distinct from OLD.lat
     and NEW.lng is not distinct from OLD.lng then
    return NEW;
  end if;

  select nickname into actor_name from public.profiles where id = actor;

  insert into public.cat_location_history(
    cat_id, changed_by, changed_by_name,
    old_lat, old_lng, old_region,
    new_lat, new_lng, new_region,
    distance_m
  ) values (
    NEW.id, actor, actor_name,
    OLD.lat, OLD.lng, OLD.region,
    NEW.lat, NEW.lng, NEW.region,
    public.calc_distance_m(OLD.lat, OLD.lng, NEW.lat, NEW.lng)
  );

  return NEW;
end;
$$;

drop trigger if exists cats_log_location_change on public.cats;
create trigger cats_log_location_change
  after update of lat, lng on public.cats
  for each row
  execute function public.log_cat_location_change();

-- 요약 뷰: 관리자 대시보드용
create or replace view public.v_recent_cat_location_changes as
select
  h.id,
  h.cat_id,
  c.name as cat_name,
  h.changed_by,
  h.changed_by_name,
  h.old_region,
  h.new_region,
  h.distance_m,
  h.created_at
from public.cat_location_history h
left join public.cats c on c.id = h.cat_id
order by h.created_at desc;

grant select on public.v_recent_cat_location_changes to authenticated;
