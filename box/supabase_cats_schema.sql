-- ══════════════════════════════════════════
-- 도시공존 — cats 테이블 + RLS
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

-- 1. 테이블 생성
create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  lat double precision not null,
  lng double precision not null,
  region text,
  tags text[] default '{}',
  caretaker_id uuid references auth.users(id) on delete set null,
  caretaker_name text,
  created_at timestamptz default now() not null
);

-- 2. 인덱스 (지도 영역 쿼리용)
create index if not exists cats_lat_lng_idx on public.cats (lat, lng);
create index if not exists cats_created_at_idx on public.cats (created_at desc);

-- 3. RLS 활성화
alter table public.cats enable row level security;

-- 4. 정책: 누구나 읽기 가능 (지도는 공개)
drop policy if exists "cats_read_public" on public.cats;
create policy "cats_read_public"
  on public.cats
  for select
  using (true);

-- 5. 정책: 인증된 유저만 등록 가능
drop policy if exists "cats_insert_authenticated" on public.cats;
create policy "cats_insert_authenticated"
  on public.cats
  for insert
  with check (auth.uid() = caretaker_id);

-- 6. 정책: 본인이 등록한 것만 수정 가능
drop policy if exists "cats_update_own" on public.cats;
create policy "cats_update_own"
  on public.cats
  for update
  using (auth.uid() = caretaker_id);

-- 7. 정책: 본인이 등록한 것만 삭제 가능
drop policy if exists "cats_delete_own" on public.cats;
create policy "cats_delete_own"
  on public.cats
  for delete
  using (auth.uid() = caretaker_id);

-- 8. Storage 버킷 정책 (cat-photos 버킷을 먼저 만들어야 함)
-- 누구나 사진 읽기 가능
drop policy if exists "cat_photos_read_public" on storage.objects;
create policy "cat_photos_read_public"
  on storage.objects
  for select
  using (bucket_id = 'cat-photos');

-- 인증된 유저만 사진 업로드 가능
drop policy if exists "cat_photos_insert_authenticated" on storage.objects;
create policy "cat_photos_insert_authenticated"
  on storage.objects
  for insert
  with check (
    bucket_id = 'cat-photos'
    and auth.role() = 'authenticated'
  );

-- 본인이 올린 사진만 삭제
drop policy if exists "cat_photos_delete_own" on storage.objects;
create policy "cat_photos_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'cat-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 9. 샘플 데이터 (테스트용 — 원하면 삭제 가능)
-- 인증 유저 없이 익명으로 들어가는 샘플 6건. caretaker_id가 null이라
-- 실제 운영에서는 위 RLS insert 정책 때문에 일반 유저는 이렇게 못 넣음.
-- 이건 SQL Editor에서 service_role로 직접 실행하므로 RLS 우회됨.
insert into public.cats (name, description, photo_url, lat, lng, region, tags, caretaker_name)
values
  ('까망이', '만수동 골목의 터줏대감. 사람을 봐도 도망가지 않아요.',
   'https://placehold.co/400x400/2A2A28/F5F3EE?text=%EA%B9%8C%EB%A7%9D%EC%9D%B4',
   37.4585, 126.7387, '만수동',
   ARRAY['TNR 완료', '사람 친화', '성묘'], '동네 캣맘'),
  ('치즈', '구월동 편의점 앞을 지키는 노란 치즈태비. 골골송이 일품.',
   'https://placehold.co/400x400/C9A961/2A2A28?text=%EC%B9%98%EC%A6%88',
   37.4500, 126.7080, '구월동',
   ARRAY['TNR 완료', '식탐 많음'], '동네 캣맘'),
  ('삼색이', '남촌동 놀이터의 작은 삼색이. 새끼 두 마리와 함께 살아요.',
   'https://placehold.co/400x400/B06478/F5F3EE?text=%EC%82%BC%EC%83%89%EC%9D%B4',
   37.4255, 126.7340, '남촌동',
   ARRAY['TNR 필요', '새끼 동반', '예민'], null),
  ('고등어', '논현동 아파트 단지의 고등어 무늬. 밤마다 순찰을 돌아요.',
   'https://placehold.co/400x400/5B7A8F/F5F3EE?text=%EA%B3%A0%EB%93%B1%EC%96%B4',
   37.4060, 126.7350, '논현동',
   ARRAY['TNR 완료', '야행성', '성묘'], '캣대디'),
  ('노랑이', '도림동 화단의 어린 노랑이. 아직 사람을 무서워해요.',
   'https://placehold.co/400x400/D4956F/2A2A28?text=%EB%85%B8%EB%9E%91%EC%9D%B4',
   37.4123, 126.7370, '도림동',
   ARRAY['TNR 필요', '어린 고양이', '겁 많음'], null),
  ('흰둥이', '장수동 빌라 골목의 하얀 고양이. 한쪽 귀가 살짝 잘려있어요(이어팁).',
   'https://placehold.co/400x400/EEEAE2/2A2A28?text=%ED%9D%B0%EB%91%A5%EC%9D%B4',
   37.4565, 126.7530, '장수동',
   ARRAY['TNR 완료', '이어팁', '온순'], '동네 캣맘');

-- 끝.
