-- 도시공존 — cat-photos 스토리지 업로드 정책 수정
-- 기존 INSERT 정책은 "인증된 유저면 누구나"였음(auth.role() = 'authenticated'만
-- 체크) — 삭제 정책(cat_photos_delete_own)은 본인 폴더로 제대로 제한돼있는데
-- 업로드만 그 제한이 빠져있었음. 즉 아무 로그인 유저나 다른 유저 폴더 경로
-- (예: {다른유저ID}/파일명)에 파일을 올릴 수 있었음 — 스토리지 남용·엉뚱한
-- 유저 폴더에 파일 주입 가능했던 구멍.
--
-- 업로드 경로가 항상 본인 uid 폴더 밑이어야 하도록 delete 정책과 동일한
-- 조건을 추가.

drop policy if exists "cat_photos_insert_authenticated" on storage.objects;
create policy "cat_photos_insert_authenticated"
  on storage.objects
  for insert
  with check (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

select 'cat-photos storage insert 정책 본인 폴더 제한 적용 완료' as status;
