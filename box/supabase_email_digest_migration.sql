-- ══════════════════════════════════════════
-- 이메일 위클리 다이제스트 — 수신 동의 + 발송 기록
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.profiles
  add column if not exists email_digest_enabled boolean not null default true,
  add column if not exists last_digest_sent_at timestamptz;

create index if not exists profiles_digest_enabled_idx
  on public.profiles (email_digest_enabled)
  where email_digest_enabled = true;

-- 본인이 자기 email_digest_enabled 를 토글할 수 있어야 함.
-- 기존 "profiles_update_self" 등의 정책이 이미 있다면 그 정책이 적용됨.
-- 정책이 없으면 아래를 추가 (이미 있으면 주석 처리하고 넘어가세요).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_self_digest'
  ) then
    create policy "profiles_update_self_digest" on public.profiles
      for update using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
-- 끝.
