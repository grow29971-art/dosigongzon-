-- ══════════════════════════════════════════
-- 📎 신고 증거 첨부 (B-2, 2026-08-02)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_support_migration.sql (reports), supabase_news_admin_migration.sql (admins)
--
-- ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
-- 1) 사진은 클라이언트에서 webp 재인코딩(convertImageToWebp) 후 업로드 —
--    EXIF(GPS·기기ID)는 재인코딩 과정에서 제거된 상태만 저장된다.
--    원본 EXIF 보존 경로는 만들지 않는다 (2026-08-02 사용자 결정: 제거본만).
-- 2) 비공개 버킷 + 단수명 서명 URL — public 버킷 금지.
-- 3) 모든 증거 행에 purge_at 파기 타이머 (기본 90일) — cron purge-safety-data가 hard delete.
-- 4) 무결성은 SHA-256 해시로만 표기 — "법적 효력"·"수사자료" 주장 금지.
-- ══════════════════════════════════════════

-- 1) 비공개 버킷
insert into storage.buckets (id, name, public)
values ('report-evidence', 'report-evidence', false)
on conflict (id) do nothing;

-- 업로드: 로그인 유저가 자기 uid 폴더에만 (report-evidence/{auth.uid()}/...)
drop policy if exists "evidence_upload_own_folder" on storage.objects;
create policy "evidence_upload_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'report-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 열람(서명 URL 생성 포함): 본인 폴더 + admin
drop policy if exists "evidence_read_own" on storage.objects;
create policy "evidence_read_own"
  on storage.objects for select
  using (
    bucket_id = 'report-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "evidence_read_admin" on storage.objects;
create policy "evidence_read_admin"
  on storage.objects for select
  using (
    bucket_id = 'report-evidence'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

-- 삭제: admin만 (파기 cron은 service_role이라 정책 무관)
drop policy if exists "evidence_delete_admin" on storage.objects;
create policy "evidence_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'report-evidence'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

-- 2) 증거 메타 테이블
create table if not exists public.report_evidence (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  uploader_id  uuid references auth.users(id) on delete set null,
  storage_path text not null,           -- report-evidence 버킷 내 경로
  sha256       text not null,           -- 업로드 시점 파일 해시 (무결성 표기용)
  purge_at     timestamptz not null default (now() + interval '90 days'),
  created_at   timestamptz not null default now()
);

create index if not exists report_evidence_report_idx on public.report_evidence (report_id);
create index if not exists report_evidence_purge_idx  on public.report_evidence (purge_at);

alter table public.report_evidence enable row level security;

-- 본인 업로드분 읽기
drop policy if exists "report_evidence_read_own" on public.report_evidence;
create policy "report_evidence_read_own"
  on public.report_evidence for select
  using (uploader_id = auth.uid());

-- admin 전체 읽기
drop policy if exists "report_evidence_read_admin" on public.report_evidence;
create policy "report_evidence_read_admin"
  on public.report_evidence for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 본인 명의 insert (자기 신고에만 첨부)
drop policy if exists "report_evidence_insert_own" on public.report_evidence;
create policy "report_evidence_insert_own"
  on public.report_evidence for insert
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.reports r
      where r.id = report_id and r.reporter_id = auth.uid()
    )
  );

-- 삭제: admin만
drop policy if exists "report_evidence_delete_admin" on public.report_evidence;
create policy "report_evidence_delete_admin"
  on public.report_evidence for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ── 검증 (실행 후) ──
-- 1) anon 키 GET /rest/v1/report_evidence → 0건 (RLS)
-- 2) anon 키로 storage report-evidence 객체 GET → 400/403 (private)
-- 3) select column_name from information_schema.columns where table_name='report_evidence';
--    → 좌표·신원 컬럼 없음 확인
-- 4) 일반 유저 JWT로 타인 report_id에 insert → 403 (자기 신고에만 첨부 가능)

-- ── ROLLBACK (되돌리기) ──
-- drop table if exists public.report_evidence;
-- drop policy if exists "evidence_upload_own_folder" on storage.objects;
-- drop policy if exists "evidence_read_own" on storage.objects;
-- drop policy if exists "evidence_read_admin" on storage.objects;
-- drop policy if exists "evidence_delete_admin" on storage.objects;
-- delete from storage.buckets where id = 'report-evidence';  -- 객체 비운 뒤에만 가능
-- notify pgrst, 'reload schema';
