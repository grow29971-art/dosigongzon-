-- ══════════════════════════════════════════
-- 🛡 QR 지킴판 — 구역 + 익명 목격제보 (B-1, 2026-08-02)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_news_admin_migration.sql (admins 테이블)
--
-- ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
-- 1) 좌표 컬럼 없음 — 위치는 QR에 심긴 구역 ID + 동 단위 라벨 텍스트만 (LBS 제약 우회).
-- 2) 피제보자(가해 의심자) 신원 컬럼 없음 — 이름·차량번호·인상착의 전용 필드 금지.
-- 3) 판정 상태값 없음 — status는 접수(received)→이관(forwarded)→종결(closed)만.
-- 4) 제보자 정보(IP·계정·GPS) 미수집 — insert는 서버 라우트가 Turnstile 검증 후
--    service_role로만 수행 (anon 직접 insert 정책을 의도적으로 만들지 않음 = 캡차 강제).
-- 5) 모든 제보 행에 purge_at 파기 타이머 (기본 90일) — cron이 hard delete.
-- ══════════════════════════════════════════

-- 1) 지킴 구역 (admin이 생성, QR에 이 id가 인코딩됨)
create table if not exists public.guardian_zones (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                    -- 예: "역삼동 돌봄구역 A" — 동 단위까지만, 상세 위치 서술 금지
  notice     text,                             -- 랜딩 추가 안내 (선택)
  active     boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.guardian_zones enable row level security;

-- 누구나(비로그인 포함) 활성 구역의 라벨 조회 — QR 랜딩 표시용
drop policy if exists "zones_read_active" on public.guardian_zones;
create policy "zones_read_active"
  on public.guardian_zones for select
  using (active = true);

-- admin 전체 읽기/쓰기
drop policy if exists "zones_read_admin" on public.guardian_zones;
create policy "zones_read_admin"
  on public.guardian_zones for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "zones_insert_admin" on public.guardian_zones;
create policy "zones_insert_admin"
  on public.guardian_zones for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "zones_update_admin" on public.guardian_zones;
create policy "zones_update_admin"
  on public.guardian_zones for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "zones_delete_admin" on public.guardian_zones;
create policy "zones_delete_admin"
  on public.guardian_zones for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 2) 익명 목격 제보 (구조화 필드만 + 사법 이관용 자유서술)
create table if not exists public.zone_reports (
  id            uuid primary key default gen_random_uuid(),
  zone_id       uuid not null references public.guardian_zones(id) on delete cascade,
  incident_type text not null check (incident_type in
                ('violence','poison_suspect','trap_suspect','shelter_damage','abandonment','other')),
  occurred_when text not null check (occurred_when in
                ('now','hours_ago','today','yesterday','earlier','unknown')),
  animal_status text not null check (animal_status in
                ('fine','injured','dead','missing','unknown')),
  detail        text,                          -- 사법 이관용 — admin 외 조회 불가(RLS), 화면 공개 금지
  status        text not null default 'received'
                check (status in ('received','forwarded','closed')),  -- 접수→이관→종결 (판정 없음)
  purge_at      timestamptz not null default (now() + interval '90 days'),
  created_at    timestamptz not null default now()
);

create index if not exists zone_reports_zone_idx  on public.zone_reports (zone_id, created_at desc);
create index if not exists zone_reports_purge_idx on public.zone_reports (purge_at);

alter table public.zone_reports enable row level security;

-- select/update/delete: admin만. insert 정책 없음(의도) — service_role 라우트 전용.
drop policy if exists "zone_reports_read_admin" on public.zone_reports;
create policy "zone_reports_read_admin"
  on public.zone_reports for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "zone_reports_update_admin" on public.zone_reports;
create policy "zone_reports_update_admin"
  on public.zone_reports for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "zone_reports_delete_admin" on public.zone_reports;
create policy "zone_reports_delete_admin"
  on public.zone_reports for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ── 검증 (실행 후) ──
-- 1) anon 키로 GET /rest/v1/zone_reports → 0건(빈 배열)이어야 함 (RLS)
-- 2) anon 키로 POST /rest/v1/zone_reports → 401/403이어야 함 (insert 정책 없음)
-- 3) anon 키로 GET /rest/v1/guardian_zones?active=eq.true → 라벨만 조회 가능
-- 4) select column_name from information_schema.columns where table_name='zone_reports';
--    → 좌표·신원 컬럼이 없는지 육안 확인

-- ── ROLLBACK (되돌리기) ──
-- drop table if exists public.zone_reports;
-- drop table if exists public.guardian_zones;
-- notify pgrst, 'reload schema';
