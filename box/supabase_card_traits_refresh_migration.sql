-- ─────────────────────────────────────────────────────────────
-- 카드 "기술" 이름 일괄 갱신 (이미 발급된 카드 전체)
-- 구버전 성격 단어(예: "식탐 장인", "겁쟁이 귀족") → 속성풍 스킬명으로 교체
-- card_traits만 갱신, 등급/스탯/이름/플레이버는 그대로 유지
-- 풀은 lib/battle-card-titles.ts의 TRAITS와 동일하게 맞출 것
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
  t1 INT; t2 INT; t3 INT;
  n INT;

  traits TEXT[] := ARRAY[
    '화염 발톱','빙결 숨결','전격 질주','맹독 이빨','그림자 도약',
    '폭풍 발톱','대지 강타','달빛 베기','섬광 일격','회오리 발차기',
    '용암 발톱','서리 발톱','벼락 발톱','암흑 강타','신성한 발톱',
    '폭염 숨결','빙하 강타','질풍 베기','맹화 발톱','심연 강타',
    '뇌전 일격','폭풍우 발톱','유성 낙하','여명의 발톱','혹한 강타'
  ];
BEGIN
  n := array_length(traits, 1);

  FOR c IN
    SELECT id
    FROM   cats
    WHERE  card_generated_at IS NOT NULL
  LOOP
    t1 := 1 + (floor(random() * n)::int % n);
    t2 := 1 + (floor(random() * n)::int % n);
    t3 := 1 + (floor(random() * n)::int % n);

    UPDATE cats
    SET card_traits = ARRAY[ traits[t1], traits[t2], traits[t3] ]
    WHERE id = c.id;
  END LOOP;

  RAISE NOTICE '카드 기술명 일괄 갱신 완료';
END $$;

-- 결과 확인
SELECT id, name, card_traits
FROM cats
WHERE card_generated_at IS NOT NULL
ORDER BY card_generated_at DESC
LIMIT 20;
