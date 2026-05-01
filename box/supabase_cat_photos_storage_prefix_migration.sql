-- ══════════════════════════════════════════
-- cat-photos 스토리지 INSERT 정책 강화
-- 다른 유저의 폴더로 업로드/덮어쓰기 차단
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 기존: bucket_id 와 인증만 검사 → 임의 폴더 prefix 허용
-- 수정: {userId}/ prefix 강제 (코드는 이미 ${user.id}/ 로 업로드 중)

drop policy if exists "cat_photos_insert_authenticated" on storage.objects;
create policy "cat_photos_insert_authenticated"
  on storage.objects
  for insert
  with check (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE 정책도 동일하게 막아두기 (덮어쓰기 차단)
drop policy if exists "cat_photos_update_own" on storage.objects;
create policy "cat_photos_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'cat-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'cat-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
