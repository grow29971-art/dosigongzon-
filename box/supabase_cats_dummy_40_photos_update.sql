-- ══════════════════════════════════════════
-- 더미 고양이 41마리에 실제 길고양이 사진 URL 덮어쓰기
-- 출처: Unsplash (무료 상업 이용 가능)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_cats_dummy_40_seed.sql 실행 후
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
-- 주의: name 기준으로 매핑 — 같은 이름의 다른 고양이가 있으면 영향 받음.
-- 필요하면 created_at 조건 추가해서 시드 직후 것만 선택.
-- ══════════════════════════════════════════

UPDATE public.cats c
SET photo_url = u.url
FROM (VALUES
  ('구월',    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop'),
  ('만수',    'https://images.unsplash.com/photo-1571566882372-1598d88abd90?w=400&h=400&fit=crop'),
  ('간석',    'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop'),
  ('장수',    'https://images.unsplash.com/photo-1494256997604-768d1f608cac?w=400&h=400&fit=crop'),
  ('서창',    'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?w=400&h=400&fit=crop'),
  ('논현',    'https://images.unsplash.com/photo-1480044965905-02098d419e96?w=400&h=400&fit=crop'),
  ('도림',    'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=400&h=400&fit=crop'),
  ('부평',    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=400&fit=crop'),
  ('산곡',    'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&h=400&fit=crop'),
  ('삼산',    'https://images.unsplash.com/photo-1494256997604-768d1f608cac?w=400&h=400&fit=crop'),
  ('청천',    'https://images.unsplash.com/photo-1513245543132-31f507417b26?w=400&h=400&fit=crop'),
  ('주안',    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop'),
  ('숭의',    'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=400&fit=crop'),
  ('학익',    'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400&h=400&fit=crop'),
  ('용현',    'https://images.unsplash.com/photo-1415369629372-26f2fe60c467?w=400&h=400&fit=crop'),
  ('송도',    'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400&h=400&fit=crop'),
  ('옥련',    'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=400&h=400&fit=crop'),
  ('차이나',  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=400&fit=crop'),
  ('역삼',    'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=400&h=400&fit=crop'),
  ('삼성',    'https://images.unsplash.com/photo-1480044965905-02098d419e96?w=400&h=400&fit=crop'),
  ('연남',    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop'),
  ('망원',    'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=400&fit=crop'),
  ('회기',    'https://images.unsplash.com/photo-1513245543132-31f507417b26?w=400&h=400&fit=crop'),
  ('성북',    'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop'),
  ('상계',    'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?w=400&h=400&fit=crop'),
  ('종로',    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop'),
  ('여의도',  'https://images.unsplash.com/photo-1494256997604-768d1f608cac?w=400&h=400&fit=crop'),
  ('문래',    'https://images.unsplash.com/photo-1438565434616-3ef039228b15?w=400&h=400&fit=crop'),
  ('건대',    'https://images.unsplash.com/photo-1571566882372-1598d88abd90?w=400&h=400&fit=crop'),
  ('상동',    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop'),
  ('중동',    'https://images.unsplash.com/photo-1480044965905-02098d419e96?w=400&h=400&fit=crop'),
  ('정왕',    'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=400&h=400&fit=crop'),
  ('고잔',    'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?w=400&h=400&fit=crop'),
  ('판교',    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&h=400&fit=crop'),
  ('일산',    'https://images.unsplash.com/photo-1571566882372-1598d88abd90?w=400&h=400&fit=crop'),
  ('행신',    'https://images.unsplash.com/photo-1478098711619-5ab0b478d6e6?w=400&h=400&fit=crop'),
  ('해운',    'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?w=400&h=400&fit=crop'),
  ('서면',    'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&h=400&fit=crop'),
  ('충장',    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop'),
  ('영통',    'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=400&fit=crop'),
  ('남촌',    'https://images.unsplash.com/photo-1513245543132-31f507417b26?w=400&h=400&fit=crop')
) AS u(name, url)
WHERE c.name = u.name
  -- 시드로 만든 것만 안전하게 지정 (caretaker_id 가 NULL이거나 특정 이름 조합)
  AND c.photo_url LIKE 'https://placehold.co/%';

-- 변경 확인용
SELECT name, region, photo_url FROM public.cats
WHERE photo_url LIKE 'https://images.unsplash.com/%'
ORDER BY created_at DESC
LIMIT 50;

-- 끝.
