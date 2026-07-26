-- ══════════════════════════════════════════
-- 동네 돌봄 실험 (14일 최소 기능 실험) 마이그레이션 (2026-07-26)
-- 목적: '한 동네 돌봄자 5명' 대상 2주 실험 — 반복 돌봄 기록·초대 전환 검증.
-- 개인정보 원칙:
--   · experiments에는 공개 가능한 지역명(public_area_name)만 저장. 정밀 좌표 저장 금지.
--   · experiment_events에는 user_id/위치/메모를 넣지 않는다 (건수 집계 전용).
--   · 초대 토큰은 원문을 저장하지 않고 sha256 해시만 저장.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행조건: admins 테이블, profiles.suspended_until 존재 (이미 프로덕션에 있음)
-- ══════════════════════════════════════════

-- ── 1) 실험 ──
create table if not exists public.experiments (
  id               uuid primary key default gen_random_uuid(),
  public_area_name text not null check (char_length(public_area_name) between 1 and 40),
  starts_at        date not null,
  ends_at          date not null,
  status           text not null default 'active' check (status in ('draft', 'active', 'ended')),
  created_by       uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  check (ends_at >= starts_at)
);

-- ── 2) 참여자 ──
-- pk(experiment_id, user_id)가 중복 참여를 DB 수준에서 차단한다.
create table if not exists public.experiment_members (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  invited_by    uuid references auth.users (id) on delete set null,
  joined_at     timestamptz not null default now(),
  primary key (experiment_id, user_id)
);

-- ── 3) 초대 (1회용 토큰, 해시만 저장) ──
create table if not exists public.experiment_invites (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  inviter_id    uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  accepted_by   uuid references auth.users (id) on delete set null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists experiment_invites_inviter_idx
  on public.experiment_invites (inviter_id, experiment_id);

-- ── 4) 실험 돌봄 기록 ──
-- unique(experiment_id, user_id, cared_on, activity_type):
-- 같은 날 같은 유형 중복 제출(연타)을 DB 수준에서 멱등 처리한다.
create table if not exists public.experiment_care_logs (
  id            uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  activity_type text not null check (activity_type in ('feed', 'water', 'clean', 'health', 'other')),
  cared_on      date not null,
  created_at    timestamptz not null default now(),
  unique (experiment_id, user_id, cared_on, activity_type)
);

create index if not exists experiment_care_logs_exp_day_idx
  on public.experiment_care_logs (experiment_id, cared_on);

-- ── 5) 최소 분석 이벤트 (건수 전용 — user_id/위치/메모 없음) ──
create table if not exists public.experiment_events (
  id            bigint generated always as identity primary key,
  experiment_id uuid references public.experiments (id) on delete cascade,
  event         text not null check (event in (
    'experiment_viewed', 'invite_link_created', 'invite_link_opened',
    'experiment_joined', 'care_log_started', 'care_log_completed', 'care_log_failed'
  )),
  created_at    timestamptz not null default now()
);

create index if not exists experiment_events_exp_idx
  on public.experiment_events (experiment_id, event);

-- ══════════════════════════════════════════
-- RLS
-- 설계 이유:
--   · 쓰기는 전부 서버 API(service_role) 경유 — 기간·멤버십·정지 검증을 코드에서 강제하고,
--     클라이언트 정책으로는 표현하기 어려운 규칙(실험 기간 내, 1회용 토큰)을 우회 못 하게 한다.
--     따라서 insert/update/delete 정책은 관리자 외에 만들지 않는다(기본 거부).
--   · 읽기는 "내 것 + 내가 속한 실험의 메타"만. 다른 참여자의 원본 기록·멤버 목록은
--     RLS로 차단하고, 지역 집계는 서버 API가 숫자만 내려준다.
-- ══════════════════════════════════════════

alter table public.experiments enable row level security;
alter table public.experiment_members enable row level security;
alter table public.experiment_invites enable row level security;
alter table public.experiment_care_logs enable row level security;
alter table public.experiment_events enable row level security;

-- experiments: 내가 참여한 실험만 읽기 (지역명·기간·상태 = 공개 가능 메타)
drop policy if exists "experiments_read_member" on public.experiments;
create policy "experiments_read_member"
  on public.experiments for select
  using (
    exists (
      select 1 from public.experiment_members m
      where m.experiment_id = id and m.user_id = auth.uid()
    )
  );

-- experiments: 관리자 전체 읽기/등록/수정
drop policy if exists "experiments_read_admin" on public.experiments;
create policy "experiments_read_admin"
  on public.experiments for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "experiments_insert_admin" on public.experiments;
create policy "experiments_insert_admin"
  on public.experiments for insert
  with check (
    exists (select 1 from public.admins where user_id = auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists "experiments_update_admin" on public.experiments;
create policy "experiments_update_admin"
  on public.experiments for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- experiment_members: 내 참여 행만 읽기 (다른 참여자 user_id 비노출 — 인원수는 서버 집계로만)
drop policy if exists "experiment_members_read_own" on public.experiment_members;
create policy "experiment_members_read_own"
  on public.experiment_members for select
  using (user_id = auth.uid());

drop policy if exists "experiment_members_read_admin" on public.experiment_members;
create policy "experiment_members_read_admin"
  on public.experiment_members for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- experiment_invites: 내가 만든 초대만 읽기 (token_hash는 해시라 노출돼도 원문 복원 불가지만
-- 열 노출 최소화를 위해 클라이언트 조회는 사실상 안 씀 — API가 생성 시 원문 1회 반환)
drop policy if exists "experiment_invites_read_own" on public.experiment_invites;
create policy "experiment_invites_read_own"
  on public.experiment_invites for select
  using (inviter_id = auth.uid());

drop policy if exists "experiment_invites_read_admin" on public.experiment_invites;
create policy "experiment_invites_read_admin"
  on public.experiment_invites for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- experiment_care_logs: 내 기록만 읽기. 타인 기록 수정·삭제는 정책 부재로 전부 거부.
drop policy if exists "experiment_care_logs_read_own" on public.experiment_care_logs;
create policy "experiment_care_logs_read_own"
  on public.experiment_care_logs for select
  using (user_id = auth.uid());

drop policy if exists "experiment_care_logs_read_admin" on public.experiment_care_logs;
create policy "experiment_care_logs_read_admin"
  on public.experiment_care_logs for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- experiment_events: 클라이언트 접근 전면 차단 (정책 없음 = 기본 거부, service_role 전용)
drop policy if exists "experiment_events_read_admin" on public.experiment_events;
create policy "experiment_events_read_admin"
  on public.experiment_events for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- drop table if exists public.experiment_events cascade;
-- drop table if exists public.experiment_care_logs cascade;
-- drop table if exists public.experiment_invites cascade;
-- drop table if exists public.experiment_members cascade;
-- drop table if exists public.experiments cascade;
-- ══════════════════════════════════════════
