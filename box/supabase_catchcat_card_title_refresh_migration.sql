-- ─────────────────────────────────────────────────────────────
-- CatchCat 카드 칭호 일괄 갱신 (이미 발급된 카드 전체)
-- 구버전 단순 형용사 칭호(예: "용감한 나비") → 포켓몬 스타일 칭호 풀로 교체
-- card_name만 갱신, 등급/스탯/특성/플레이버는 그대로 유지
-- 칭호 풀은 lib/battle-card-titles.ts의 TITLES와 동일하게 맞출 것
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
  idx INT;
  n INT;
  new_title TEXT;

  common_titles TEXT[] := ARRAY[
    '골목의 터줏대감', '낮잠 제국의 황제', '박스 수호신', '간식 탐정',
    '지붕 위의 방랑자', '새벽 골목 순찰대', '그늘의 주민', '밥그릇 지킴이',
    '종이봉투 파괴자', '무릎 위의 지배자', '창가의 감시자', '햇살 수집가',
    '하품의 달인', '캣타워의 왕', '골목 입구의 터줏대감', '먼지 속의 철학자',
    '쓰레기통 옆 귀족', '담벼락 위의 사색가', '츄르를 기다리는 자'
  ];
  uncommon_titles TEXT[] := ARRAY[
    '달빛 사냥꾼', '골목의 왕', '별빛 아래의 철학자', '새벽의 파수꾼',
    '어둠 속의 관찰자', '발소리 없는 사냥꾼', '도도한 귀족', '그림자를 걷는 자',
    '비 오는 날의 현자', '골목의 영주', '눈빛만으로 지배하는 자',
    '폭풍 전 고요의 수호자', '황혼의 사냥꾼', '심야의 탐험가',
    '도시를 헤매는 방랑 기사', '별빛을 먹고 자란 아이'
  ];
  rare_titles TEXT[] := ARRAY[
    '번개 눈빛의 소유자', '강철 발톱의 기사', '폭풍을 부르는 자',
    '전설적 간식 헌터', '시간을 멈추는 눈빛', '어둠의 귀족',
    '골목의 전설', '달을 삼킨 사냥꾼', '고독한 제왕',
    '벼락을 품은 야수', '밤을 지배하는 자', '운명을 뛰어넘은 존재',
    '두 세계를 걷는 자', '별자리를 꿰뚫는 눈빛'
  ];
  legendary_titles TEXT[] := ARRAY[
    '세상을 본 자', '천년을 걷는 존재', '신화가 된 고양이',
    '시대를 초월한 전설', '별을 삼킨 황제', '전설 그 자체',
    '우주를 품은 눈빛', '신들도 경배하는', '불멸의 지배자',
    '모든 골목의 신', '세상 끝을 본 자', '현실을 구부리는 존재'
  ];
BEGIN
  FOR c IN
    SELECT id, name, card_rarity
    FROM   cats
    WHERE  card_generated_at IS NOT NULL
  LOOP
    CASE c.card_rarity
      WHEN 'legendary' THEN n := array_length(legendary_titles, 1);
      WHEN 'rare'      THEN n := array_length(rare_titles, 1);
      WHEN 'uncommon'  THEN n := array_length(uncommon_titles, 1);
      ELSE                  n := array_length(common_titles, 1);
    END CASE;

    idx := 1 + (floor(random() * n)::int % n);

    new_title := CASE c.card_rarity
      WHEN 'legendary' THEN legendary_titles[idx]
      WHEN 'rare'      THEN rare_titles[idx]
      WHEN 'uncommon'  THEN uncommon_titles[idx]
      ELSE                  common_titles[idx]
    END;

    UPDATE cats
    SET card_name = new_title || ' ' || c.name
    WHERE id = c.id;
  END LOOP;

  RAISE NOTICE '카드 칭호 일괄 갱신 완료';
END $$;

-- 결과 확인
SELECT id, name, card_rarity, card_name
FROM cats
WHERE card_generated_at IS NOT NULL
ORDER BY card_rarity, name;
