-- ══════════════════════════════════════════
-- 서클 채팅 사진 비공개 버킷 전환 (2026-07-26 보안 패치 — 초안, 운영 적용 대기)
-- 문제: 서클(회원제) 채팅 사진이 공개 버킷 cat-photos에 저장돼 URL만 알면
--       비멤버도 열람 가능 (멤버 전용 콘텐츠의 공개 노출).
-- 해결: private 버킷 circle-photos + 업로드는 멤버만(RLS) +
--       열람은 서버 API(/api/circle/image-url)가 멤버십 검증 후 5분 TTL signed URL 발급.
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent — 재실행 안전)
-- ⚠️ 이 SQL 실행 전에 새 코드가 배포되면 "사진 첨부"만 실패하고(명확한 에러 안내)
--    기존 채팅·기존 사진 표시는 정상 동작한다. 전략 문서: box/서클사진_비공개전환_전략.md
-- ══════════════════════════════════════════

-- 1) private 버킷 생성 (이미 있으면 public=false로 강제)
insert into storage.buckets (id, name, public)
values ('circle-photos', 'circle-photos', false)
on conflict (id) do update set public = false;

-- 2) 업로드 정책 — 경로 규약: {circle_id}/{sender_uid}/{uuid}.webp
--    · 두 번째 폴더가 본인 uid여야 함 (타인 명의 업로드 차단)
--    · 첫 번째 폴더의 서클에 대해 owner 또는 accepted 멤버여야 함
drop policy if exists "circle_photos_member_upload" on storage.objects;
create policy "circle_photos_member_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'circle-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (
      exists (
        select 1 from public.caretaker_circles c
        where c.id::text = (storage.foldername(name))[1]
          and c.owner_id = auth.uid()
      )
      or exists (
        select 1 from public.circle_members m
        where m.circle_id::text = (storage.foldername(name))[1]
          and m.member_id = auth.uid()
          and m.status = 'accepted'
      )
    )
  );

-- 3) 본인 업로드 삭제 허용 (메시지 삭제 시 정리용 — 선택적)
drop policy if exists "circle_photos_own_delete" on storage.objects;
create policy "circle_photos_own_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'circle-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 4) SELECT 정책은 만들지 않는다 — private 버킷 + 정책 부재 = 직접 열람 불가.
--    열람은 서버(service_role)가 멤버십 검증 후 createSignedUrl(300초)로만 발급.

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- drop policy if exists "circle_photos_member_upload" on storage.objects;
-- drop policy if exists "circle_photos_own_delete" on storage.objects;
-- -- 버킷은 객체가 있으면 삭제 불가 — 객체 정리 후:
-- -- delete from storage.buckets where id = 'circle-photos';
-- ══════════════════════════════════════════
