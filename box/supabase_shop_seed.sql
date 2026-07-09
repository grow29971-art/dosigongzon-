-- ══════════════════════════════════════════
-- 쇼핑몰 시드: 카테고리별 3개 × 7 = 21개 샘플 상품
-- 실행: Supabase SQL Editor (supabase_shop_v2_migration.sql 이후)
-- ⚠ Chrome 번역 OFF
-- images는 빈 배열 — 실제 상품 등록 시 Storage 업로드로 교체
-- ══════════════════════════════════════════

insert into public.products
  (name, description, price, sale_price, category, images, stock, is_active, shipping_fee, badge, is_donation, donation_percent, weight, is_virtual)
values
-- ── 사료·간식 (food) ──
('캐츠랑 전연령 고양이사료 20kg',
 '길고양이 급식에 가장 많이 쓰이는 가성비 사료. 전연령 대응.',
 45000, null, 'food', '{}', 99, true, 0, '인기', true, 20, '20kg', false),

('이나바 츄르 참치맛 60개입',
 '길고양이 친화도 높이기에 최고. 경계심 있는 아이들도 다가옵니다.',
 18900, null, 'food', '{}', 99, true, 3000, null, true, 20, '60개입', false),

('오리젠 캣&키튼 1.8kg',
 '집고양이 프리미엄 사료. 85% 동물성 원료, 곡물 프리.',
 38000, null, 'food', '{}', 99, true, 3000, null, true, 20, '1.8kg', false),

-- ── 모래·위생 (sand) ──
('두부모래 오리지널 7L x 6개',
 '먼지 적고 화장실에 버릴 수 있어 편리. 임보 고양이에게도 추천.',
 23900, null, 'sand', '{}', 99, true, 0, '인기', true, 20, '7L x 6개', false),

('벤토나이트 모래 무향 10L',
 '강력한 응고력. 다묘 가정에 경제적인 선택.',
 8900, null, 'sand', '{}', 99, true, 3000, null, true, 20, '10L', false),

('고양이 화장실 탈취제 스프레이 300ml',
 '화장실 주변 냄새 제거. 천연 성분으로 고양이에게 안전.',
 9500, null, 'sand', '{}', 99, true, 3000, null, true, 20, '300ml', false),

-- ── 건강·케어 (health) ──
('고양이 종합 유산균 30포',
 '야외 생활로 장이 약한 길고양이에게. 사료에 뿌려서 급여.',
 15000, null, 'health', '{}', 99, true, 3000, null, true, 20, '30포', false),

('타우린 영양제 60정',
 '고양이 필수 아미노산. 심장과 눈 건강에 도움.',
 12000, null, 'health', '{}', 99, true, 3000, null, true, 20, '60정', false),

('눈/귀 세정제 120ml',
 '눈곱, 귀지 관리. TNR 후 관리나 일상 케어에 유용.',
 9800, null, 'health', '{}', 99, true, 3000, null, true, 20, '120ml', false),

-- ── 장난감·용품 (toy) ──
('3단 낚시대 장난감 (깃털+방울)',
 '고양이 사냥 본능 자극. 3단 길이 조절 가능.',
 4500, null, 'toy', '{}', 99, true, 3000, null, true, 20, null, false),

('대형 캣닢 쿠션',
 '캣닢 듬뿍. 킥킥 놀이와 베개로 활용. 세탁 가능.',
 8900, null, 'toy', '{}', 99, true, 3000, '신상', true, 20, null, false),

('골판지 스크래쳐 라운지',
 '스크래칭과 낮잠을 한 번에. 리필 골판지 교체 가능.',
 15900, null, 'toy', '{}', 99, true, 3000, null, true, 20, null, false),

-- ── 급식·쉼터 (shelter) ──
('스테인리스 급식 그릇 2구',
 '사료와 물을 동시에. 야외 급식소 설치용 2구 그릇.',
 8500, null, 'shelter', '{}', 99, true, 3000, null, true, 20, null, false),

('방수 야외 고양이 쉼터 하우스',
 '비바람을 막아주는 야외 쉼터. 스티로폼 내장으로 보온 효과.',
 35000, null, 'shelter', '{}', 99, true, 0, '신상', true, 20, null, false),

('접이식 고양이 이동장',
 'TNR 이동, 병원 이동 시 필수. 접으면 납작하게 보관 가능.',
 25000, null, 'shelter', '{}', 99, true, 3000, null, true, 20, null, false),

-- ── 굿즈 (goods) ──
('도시공존 로고 스티커팩 (8종)',
 '급식소, 노트북, 텀블러에. 도시공존 로고 스티커 8종 세트. 우편 발송.',
 3500, null, 'goods', '{}', 99, true, 0, '신상', true, 20, null, false),

('캣대디 에코백',
 '사료 담아가기 딱 좋은 튼튼한 에코백. 도시공존 로고 프린트.',
 15000, null, 'goods', '{}', 99, true, 3000, null, true, 20, null, false),

('길고양이 아크릴 키링',
 '도시공존 캐릭터 아크릴 키링. 가방이나 열쇠에. 우편 발송.',
 8000, null, 'goods', '{}', 99, true, 0, null, true, 20, null, false),

-- ── 후원하기 (support) — 가상상품, 전액 후원 ──
('길고양이 한 끼 선물하기',
 '3,000원으로 길고양이에게 한 끼를 선물하세요. 전액 급식 활동에 사용됩니다.',
 3000, null, 'support', '{}', 9999, true, 0, null, true, 100, null, true),

('쉼터 설치 기금 후원',
 '길고양이 쉼터 설치를 위한 기금. 전액 쉼터 제작·설치에 사용됩니다.',
 10000, null, 'support', '{}', 9999, true, 0, null, true, 100, null, true),

('길고양이 겨울나기 후원',
 '추운 겨울, 길고양이의 보온을 위해. 핫팩·보온패드 구매에 전액 사용됩니다.',
 5000, null, 'support', '{}', 9999, true, 0, null, true, 100, null, true);

-- 끝.
