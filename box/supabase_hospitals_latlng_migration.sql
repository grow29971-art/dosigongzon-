-- ══════════════════════════════════════════
-- rescue_hospitals에 lat/lng 좌표 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_rescue_hospitals_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.rescue_hospitals
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- 샘플 병원 (좌표 포함) — 없으면 insert
insert into public.rescue_hospitals (name, city, district, address, phone, hours, note, tags, lat, lng)
values
  ('인천 남동 동물병원', '인천광역시', '남동구', '인천시 남동구 구월남로 82', '032-432-7575', '09:00~21:00', '길고양이 할인 적용', ARRAY['길고양이 할인', 'TNR 협력'], 37.4489, 126.7315),
  ('서울 강남 24시 동물메디컬센터', '서울특별시', '강남구', '서울시 강남구 테헤란로 152', '02-555-7582', '24시간', '24시 응급 · 길고양이 치료 지원', ARRAY['24시', '응급'], 37.5010, 127.0396),
  ('부산 해운대 고양이전문병원', '부산광역시', '해운대구', '부산시 해운대구 중동2로 10', '051-747-8275', '10:00~20:00', '고양이 전문', ARRAY['고양이 전문', 'TNR 협력'], 35.1620, 129.1630),
  ('대구 수성 동물의료센터', '대구광역시', '수성구', '대구시 수성구 달구벌대로 2520', '053-763-0075', '09:00~22:00', 'TNR 수술 지원', ARRAY['TNR 협력'], 35.8385, 128.6310),
  ('제주 동물사랑병원', '제주특별자치도', '제주시', '제주시 연동 312-24', '064-749-0075', '09:00~19:00', '길고양이 무료 진료 (예약)', ARRAY['길고양이 할인', '무료 진료'], 33.4870, 126.4920)
on conflict do nothing;

notify pgrst, 'reload schema';
-- 끝.
