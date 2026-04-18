-- ══════════════════════════════════════════
-- 더미 고양이 40마리 시드 (테스트 / 데모용)
-- 실행 위치: Supabase Dashboard → SQL Editor (service_role)
-- 선행: supabase_cats_schema.sql, supabase_cat_profile_columns_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
-- 위치 분포:
--   인천 남동구/부평구/미추홀구/연수구/중구 (18마리)
--   서울 강남/마포/동대문/성북/노원/종로/영등포 (12마리)
--   경기 부천/시흥/안산/성남/고양 (7마리)
--   부산/광주 (3마리)
-- ══════════════════════════════════════════

INSERT INTO public.cats (
  name, description, photo_url, lat, lng, region, tags,
  gender, neutered, health_status, caretaker_name
) VALUES

-- ══ 인천 남동구 (7) ══
('구월', '남동구청 뒷골목의 친근한 고등어.',
 'https://placehold.co/400x400/5B7A8F/F5F3EE?text=Guwol',
 37.4470, 126.7320, '구월동',
 ARRAY['TNR 완료','사람 친화','성묘'], 'male', true, 'good', '남동 캣맘'),

('만수', '만수공원 벤치 아래 자주 보이는 삼색이.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Mansu',
 37.4495, 126.7490, '만수동',
 ARRAY['TNR 필요','겁 많음'], 'female', false, 'good', null),

('간석', '간석오거리역 근처 주차장 모퉁이에서 살아요.',
 'https://placehold.co/400x400/2A2A28/F5F3EE?text=Ganseok',
 37.4570, 126.7070, '간석동',
 ARRAY['TNR 완료','예민'], 'male', true, 'good', '간석 이웃'),

('장수', '장수동 공원 화단 속 숨숨집에서 살아요. 겨울 담요 지원 중.',
 'https://placehold.co/400x400/D4956F/2A2A28?text=Jangsu',
 37.4405, 126.7605, '장수동',
 ARRAY['TNR 완료','성묘','온순'], 'female', true, 'good', '장수 캣대디'),

('서창', '서창2지구 아파트 단지의 새끼 고양이. 어미와 함께.',
 'https://placehold.co/400x400/C9A961/2A2A28?text=Seochang',
 37.4190, 126.7470, '서창동',
 ARRAY['어린 고양이','새끼 동반','겁 많음'], 'unknown', false, 'caution', '서창 자원봉사자'),

('논현', '논현지구 공영주차장에 사는 카리스마 넘치는 검은 고양이.',
 'https://placehold.co/400x400/1E1E1C/F5F3EE?text=Nonhyeon',
 37.4000, 126.7350, '논현동',
 ARRAY['TNR 완료','야행성'], 'male', true, 'good', null),

('도림', '도림동 주택가에서 다리를 약간 절어요. 병원 방문 예정.',
 'https://placehold.co/400x400/8A7A6F/F5F3EE?text=Dorim',
 37.4250, 126.7150, '도림동',
 ARRAY['TNR 필요','성묘'], 'male', false, 'caution', '도림 돌보미'),

-- ══ 인천 부평구 (4) ══
('부평', '부평역 지하상가 입구 근처의 노란 고양이.',
 'https://placehold.co/400x400/D4B062/2A2A28?text=Bupyeong',
 37.4895, 126.7247, '부평동',
 ARRAY['TNR 완료','사람 친화','식탐 많음'], 'female', true, 'good', '부평 상인회'),

('산곡', '산곡동 재개발 지역에서 이주 중. 안전한 곳 필요.',
 'https://placehold.co/400x400/6B6B68/F5F3EE?text=Sangok',
 37.4960, 126.7140, '산곡동',
 ARRAY['TNR 필요','예민'], 'male', false, 'caution', null),

('삼산', '삼산월드체육관 근처 공원의 명랑한 치즈.',
 'https://placehold.co/400x400/E8B040/2A2A28?text=Samsan',
 37.5100, 126.7470, '삼산동',
 ARRAY['TNR 완료','사람 친화'], 'male', true, 'good', '삼산 캣맘'),

('청천', '청천동 주택가에서 귀에 상처가 보여요. TNR 이어팁.',
 'https://placehold.co/400x400/7A9A7E/F5F3EE?text=Cheongcheon',
 37.5170, 126.6980, '청천동',
 ARRAY['TNR 완료','이어팁','성묘'], 'female', true, 'good', null),

-- ══ 인천 미추홀구 (4) ══
('주안', '주안역 북광장 화단의 검은 고양이. 매일 같은 자리.',
 'https://placehold.co/400x400/2A2A28/D4B062?text=Juan',
 37.4640, 126.6790, '주안동',
 ARRAY['TNR 완료','성묘','야행성'], 'male', true, 'good', '주안 자원봉사자'),

('숭의', '숭의동 주택가 옥상에서 밥 먹는 삼색이 가족.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Sungui',
 37.4580, 126.6540, '숭의동',
 ARRAY['새끼 동반','사람 친화'], 'female', false, 'good', '숭의 이웃'),

('학익', '학익동 학원가 뒤 주차장의 장모종. 엉덩이 털이 풍성해요.',
 'https://placehold.co/400x400/8A8A88/F5F3EE?text=Hagik',
 37.4410, 126.6680, '학익동',
 ARRAY['TNR 완료','성묘','온순'], 'male', true, 'good', '학익 집사'),

('용현', '용현동 시장 뒷골목 — 상인들이 번갈아 밥을 줘요.',
 'https://placehold.co/400x400/D4956F/2A2A28?text=Yonghyeon',
 37.4440, 126.6540, '용현동',
 ARRAY['TNR 완료','사람 친화','식탐 많음'], 'female', true, 'good', '용현시장 상인회'),

-- ══ 인천 연수구 (2) ══
('송도', '송도국제도시 공원의 인싸 고양이. 산책하는 주민 손을 핥아요.',
 'https://placehold.co/400x400/F5F3EE/C47E5A?text=Songdo',
 37.3800, 126.6580, '송도동',
 ARRAY['TNR 완료','사람 친화','성묘'], 'male', true, 'good', '송도 캣대디'),

('옥련', '옥련동 언덕 위 공원의 조용한 회색 고양이.',
 'https://placehold.co/400x400/6B6B68/F5F3EE?text=Okryeon',
 37.4180, 126.6430, '옥련동',
 ARRAY['TNR 완료','예민','성묘'], 'female', true, 'good', null),

-- ══ 인천 중구 (1) ══
('차이나', '차이나타운 계단 위에 사는 사람 좋아하는 노랑이.',
 'https://placehold.co/400x400/E88D5A/F5F3EE?text=China',
 37.4730, 126.6210, '북성동',
 ARRAY['TNR 완료','사람 친화'], 'male', true, 'good', '차이나타운 돌보미'),

-- ══ 서울 강남구 (2) ══
('역삼', '역삼역 2번 출구 뒷골목의 회색 나비. 직장인들이 챙겨요.',
 'https://placehold.co/400x400/8A8A88/F5F3EE?text=Yeoksam',
 37.5012, 127.0366, '역삼동',
 ARRAY['TNR 완료','사람 친화','성묘'], 'female', true, 'good', '강남 캣맘'),

('삼성', '삼성역 코엑스 주차장 모서리의 온순한 검은 고양이.',
 'https://placehold.co/400x400/2A2A28/F5F3EE?text=Samseong',
 37.5080, 127.0630, '삼성동',
 ARRAY['TNR 완료','온순'], 'male', true, 'good', null),

-- ══ 서울 마포구 (2) ══
('연남', '연남동 카페거리의 인기스타 치즈태비.',
 'https://placehold.co/400x400/C9A961/2A2A28?text=Yeonnam',
 37.5660, 126.9240, '연남동',
 ARRAY['TNR 완료','사람 친화','식탐 많음'], 'female', true, 'good', '연남 집사'),

('망원', '망원시장 상인회가 돌보는 터줏대감 삼색이.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Mangwon',
 37.5550, 126.9050, '망원동',
 ARRAY['TNR 완료','성묘'], 'female', true, 'good', '망원시장 상인회'),

-- ══ 서울 동대문구 (1) ══
('회기', '회기역 경희대 담벼락의 장난꾸러기 고등어.',
 'https://placehold.co/400x400/5B7A8F/F5F3EE?text=Hoegi',
 37.5898, 127.0577, '회기동',
 ARRAY['TNR 완료','새끼 동반'], 'female', true, 'good', '경희대 동아리'),

-- ══ 서울 성북구 (1) ══
('성북', '성북동 언덕길 주택가의 관록 있는 검은 고양이.',
 'https://placehold.co/400x400/1E1E1C/D4B062?text=Seongbuk',
 37.5942, 126.9980, '성북동',
 ARRAY['TNR 완료','성묘','야행성'], 'male', true, 'good', null),

-- ══ 서울 노원구 (1) ══
('상계', '상계동 아파트 뒤 화단에서 아이들이 사랑해요.',
 'https://placehold.co/400x400/D4956F/F5F3EE?text=Sanggye',
 37.6620, 127.0730, '상계동',
 ARRAY['TNR 완료','사람 친화','어린 고양이'], 'female', false, 'good', '상계 돌보미'),

-- ══ 서울 종로구 (1) ══
('종로', '탑골공원 근처 오래된 터줏대감 검은 고양이.',
 'https://placehold.co/400x400/2A2A28/F5F3EE?text=Jongro',
 37.5705, 126.9880, '종로3가',
 ARRAY['TNR 완료','성묘','온순'], 'male', true, 'good', '종로 자원봉사자'),

-- ══ 서울 영등포구 (2) ══
('여의도', '여의도공원 벤치 아래에서 자주 보이는 친근한 치즈.',
 'https://placehold.co/400x400/E8B040/2A2A28?text=Yeouido',
 37.5260, 126.9245, '여의도동',
 ARRAY['TNR 완료','사람 친화'], 'female', true, 'good', '여의도 직장인'),

('문래', '문래창작촌 골목의 예술가풍 회색 고양이.',
 'https://placehold.co/400x400/6B6B68/F5F3EE?text=Mullae',
 37.5175, 126.8920, '문래동',
 ARRAY['TNR 완료','예민','성묘'], 'male', true, 'caution', null),

-- ══ 서울 광진구 (1) ══
('건대', '건대입구역 먹자골목에 사는 통통한 삼색이.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Kondae',
 37.5400, 127.0700, '화양동',
 ARRAY['TNR 완료','식탐 많음'], 'female', true, 'good', '건대 이웃'),

-- ══ 경기 부천 (2) ══
('상동', '상동호수공원 산책로의 사람 좋아하는 노랑이.',
 'https://placehold.co/400x400/E8B040/2A2A28?text=Sangdong',
 37.5030, 126.7540, '상동',
 ARRAY['TNR 완료','사람 친화'], 'female', true, 'good', '부천 돌보미'),

('중동', '중동역 지하상가 쪽 주차장의 예민한 검은 고양이.',
 'https://placehold.co/400x400/1E1E1C/F5F3EE?text=Jungdong',
 37.5040, 126.7620, '중동',
 ARRAY['TNR 필요','예민'], 'male', false, 'caution', null),

-- ══ 경기 시흥 (1) ══
('정왕', '정왕동 산업단지 근처의 꾀죄죄하지만 씩씩한 고양이.',
 'https://placehold.co/400x400/8A7A6F/F5F3EE?text=Jeongwang',
 37.3480, 126.7410, '정왕동',
 ARRAY['TNR 필요','성묘'], 'male', false, 'caution', '시흥 자원봉사자'),

-- ══ 경기 안산 (1) ══
('고잔', '고잔동 아파트 단지의 새끼 고양이 4남매. 어미 행방불명.',
 'https://placehold.co/400x400/D4956F/2A2A28?text=Gojan',
 37.3165, 126.8390, '고잔동',
 ARRAY['어린 고양이','새끼 동반','겁 많음'], 'unknown', false, 'danger', '고잔 구조팀'),

-- ══ 경기 성남 (1) ══
('판교', '판교 테크노밸리 사옥 화단의 직장인 돌봄 고양이.',
 'https://placehold.co/400x400/C9A961/2A2A28?text=Pangyo',
 37.4020, 127.1080, '삼평동',
 ARRAY['TNR 완료','사람 친화'], 'female', true, 'good', '판교 직장인'),

-- ══ 경기 고양 (2) ══
('일산', '일산 호수공원 벤치 아래 자주 보이는 삼색이.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Ilsan',
 37.6710, 126.7680, '장항동',
 ARRAY['TNR 완료','성묘','온순'], 'female', true, 'good', '일산 캣맘'),

('행신', '행신동 주택가에서 다리를 절룩이는 고양이. 구조 필요.',
 'https://placehold.co/400x400/8A7A6F/F5F3EE?text=Haengsin',
 37.6130, 126.8320, '행신동',
 ARRAY['TNR 필요'], 'male', false, 'danger', '행신 주민'),

-- ══ 부산 (2) ══
('해운', '해운대 달맞이길 계단에서 자주 보이는 삼색이.',
 'https://placehold.co/400x400/B06478/F5F3EE?text=Haeun',
 35.1601, 129.1650, '중동',
 ARRAY['TNR 완료','새끼 동반'], 'female', false, 'good', '해운대 캣맘'),

('서면', '서면 롯데백화점 뒤 주차장 모퉁이의 검은 고양이.',
 'https://placehold.co/400x400/2A2A28/F5F3EE?text=Seomyeon',
 35.1575, 129.0597, '부전동',
 ARRAY['TNR 필요','예민'], 'male', false, 'caution', null),

-- ══ 광주 (1) ══
('충장', '충장로 번화가 뒷골목의 인기 많은 노랑 고양이.',
 'https://placehold.co/400x400/E8B040/2A2A28?text=Chungjang',
 35.1469, 126.9200, '충장동',
 ARRAY['TNR 완료','사람 친화','식탐 많음'], 'male', true, 'good', '충장 상인회'),

-- ══ 경기 수원 (1) ══
('영통', '영통구 아파트 화단의 세 자매 고양이. 함께 지내요.',
 'https://placehold.co/400x400/C9A961/2A2A28?text=Yeongtong',
 37.2570, 127.0580, '영통동',
 ARRAY['TNR 완료','새끼 동반'], 'female', true, 'good', '영통 이웃'),

-- ══ 인천 남동구 추가 (1) ══
('남촌', '남촌동 공원의 귀 이어팁 잘린 TNR 마스터 고등어.',
 'https://placehold.co/400x400/5B7A8F/F5F3EE?text=Namchon',
 37.4295, 126.7360, '남촌동',
 ARRAY['TNR 완료','이어팁','온순'], 'male', true, 'good', '남촌 돌보미');

-- 끝 — 총 40마리.
-- 되돌리기 원하면:
--   DELETE FROM public.cats WHERE caretaker_id IS NULL AND name IN ('구월','만수',...);
