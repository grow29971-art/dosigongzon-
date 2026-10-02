-- ══════════════════════════════════════════
-- 10/2 감사 결정 4건 중 DB 3건 (나머지 1건 병원 자동숨김 제거는 코드)
-- ① 기금 투표 비로그인 RPC 실행 권한 회수 — 로그인 1인 1표만 (기존 표는 유지)
-- ② cat-photos 버킷: 이미지 형식(webp·jpeg·png)·10MB 상한 — 앱 업로드는 전부 webp
-- ③ 돌봄기록 작성자 표시명을 현재 프로필 닉네임으로 정리 — 예전 기록엔 소셜 계정 실명이 남아 있었다.
--    원본은 private.care_logs_author_name_backup에 보관(롤백용). 관리자 계정 기록은 제외.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF — 2026-10-02 실행·검증(백업 60건, anon 투표 실행권 false, 버킷 제한 반영)
-- ══════════════════════════════════════════

-- ①
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace='public'::regnamespace and p.proname='cast_fund_vote_anon' loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- ②
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'],
       file_size_limit = 10485760
 where id = 'cat-photos';

-- ③
create table if not exists private.care_logs_author_name_backup (
  id uuid primary key, author_name text, backed_up_at timestamptz not null default now()
);
alter table private.care_logs_author_name_backup enable row level security;
insert into private.care_logs_author_name_backup (id, author_name)
  select cl.id, cl.author_name
    from public.care_logs cl join public.profiles p on p.id = cl.author_id
   where p.nickname is not null and trim(p.nickname) <> ''
     and cl.author_name is distinct from p.nickname
     and not exists (select 1 from public.admins a where a.user_id = cl.author_id)
  on conflict (id) do nothing;
update public.care_logs cl
   set author_name = p.nickname
  from public.profiles p
 where p.id = cl.author_id
   and cl.id in (select id from private.care_logs_author_name_backup);

-- ── 검증 ──
-- select has_function_privilege('anon', 'public.cast_fund_vote_anon(uuid,uuid)', 'execute'); → false
-- select allowed_mime_types, file_size_limit from storage.buckets where id = 'cat-photos';
-- select count(*) from private.care_logs_author_name_backup;
-- ── 롤백 ──
-- grant execute on function public.cast_fund_vote_anon(uuid, uuid) to anon, authenticated;
-- update storage.buckets set allowed_mime_types = null, file_size_limit = null where id = 'cat-photos';
-- update public.care_logs cl set author_name = b.author_name from private.care_logs_author_name_backup b where b.id = cl.id;
