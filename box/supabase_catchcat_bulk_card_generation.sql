-- ─────────────────────────────────────────────────────────────
-- CatchCat 카드 일괄 생성 (기존 고양이 전체)
-- card_generated_at IS NULL인 모든 고양이에게 랜덤 카드 부여
-- 희귀도 분포: common 55% / uncommon 25% / rare 13% / legendary 7%
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
  r1 FLOAT; r2 FLOAT; r3 FLOAT; r4 FLOAT;
  rarity TEXT;
  adj_idx   INT;
  f_idx     INT;
  t1 INT; t2 INT; t3 INT;
  n_adjs  INT;
  n_traits INT;
  n_flavors INT;

  adjs TEXT[] := ARRAY[
    '철학자', '용감한', '탐험가', '신비로운', '잠꾸러기',
    '장난꾸러기', '사색가', '꿈꾸는', '방랑자', '지혜로운',
    '영리한', '당찬', '순한', '도도한', '느긋한',
    '용맹한', '온화한', '호기심 많은', '고집스러운', '겁쟁이',
    '충성스러운', '변덕스러운', '자유로운', '포근한', '예민한'
  ];

  traits TEXT[] := ARRAY[
    '애교쟁이', '독립적', '수다쟁이', '조용함', '장난꾸러기',
    '겁쟁이', '용감함', '사교적', '내성적', '호기심 많음',
    '식탐', '잠꾸러기', '활발함', '도도함', '온순함',
    '영리함', '고집스러움', '느긋함', '충성스러움', '변덕스러움',
    '겁이 없음', '예민함', '포근함', '사냥꾼 기질', '경계심 강함'
  ];

  flavors TEXT[] := ARRAY[
    '골목의 철학자, 오늘도 세상을 관찰한다',
    '밥만 있으면 세상이 내 것',
    '내 페이스대로 살아갈 뿐',
    '이 동네의 진짜 주인은 나야',
    '경계는 잠깐, 츄르는 영원히',
    '낮에는 잠, 밤에는 탐험',
    '나만의 길을 걷는 자유로운 영혼',
    '두 눈에 별빛을 담고 태어난 아이',
    '골목대장의 위엄이 느껴지는가',
    '먹고 자고 버티는 것이 삶',
    '세상 모든 종이봉투는 내 것',
    '햇볕 한 줌이면 충분해',
    '마음을 열기까지 시간이 필요할 뿐',
    '이 동네 소문은 나한테 물어봐',
    '눈빛만으로 모든 걸 말한다',
    '밥그릇 앞에서만 꼬리를 흔든다',
    '차갑지만 누구보다 따뜻한 아이',
    '골목 끝 신화의 주인공',
    '모든 상자는 내 집이 된다',
    '비가 와도 내 자리는 내가 지킨다'
  ];

BEGIN
  n_adjs   := array_length(adjs,   1);
  n_traits := array_length(traits, 1);
  n_flavors:= array_length(flavors,1);

  FOR c IN
    SELECT id, name
    FROM   cats
    WHERE  card_generated_at IS NULL
  LOOP
    r1 := random();
    r2 := random();
    r3 := random();
    r4 := random();

    -- 희귀도 (weighted)
    rarity := CASE
      WHEN r1 < 0.55 THEN 'common'
      WHEN r1 < 0.80 THEN 'uncommon'
      WHEN r1 < 0.93 THEN 'rare'
      ELSE                 'legendary'
    END;

    -- 인덱스 (1-based, 범위 초과 방지)
    adj_idx := 1 + (floor(r2 * n_adjs)::int   % n_adjs);
    f_idx   := 1 + (floor(r3 * n_flavors)::int % n_flavors);
    t1 := 1 + (floor(random() * n_traits)::int % n_traits);
    t2 := 1 + (floor(random() * n_traits)::int % n_traits);
    t3 := 1 + (floor(random() * n_traits)::int % n_traits);

    UPDATE cats SET
      card_rarity  = rarity,
      card_name    = adjs[adj_idx] || ' ' || c.name,
      card_traits  = ARRAY[ traits[t1], traits[t2], traits[t3] ],
      card_stats   = jsonb_build_object(
                       'cuteness',       20 + (floor(random() * 81))::int,
                       'wildness',       20 + (floor(random() * 81))::int,
                       'sociability',    15 + (floor(random() * 76))::int,
                       'mysteriousness', 20 + (floor(random() * 81))::int
                     ),
      card_flavor  = flavors[f_idx],
      card_generated_at = NOW()
    WHERE id = c.id;

  END LOOP;

  RAISE NOTICE '카드 일괄 생성 완료';
END $$;

-- 결과 확인
SELECT
  card_rarity,
  COUNT(*) AS cnt,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM cats
WHERE card_generated_at IS NOT NULL
GROUP BY card_rarity
ORDER BY cnt DESC;
