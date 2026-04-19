-- ══════════════════════════════════════════
-- 더미 커뮤니티 글에 댓글 시드 (약 150~200개)
-- author_id = NULL (비회원 게시글에 붙는 비회원 댓글 모사)
-- 카테고리별 톤 다르게, 닉네임 풀에서 순환
-- 실행 위치: Supabase Dashboard → SQL Editor (service_role)
-- 선행: supabase_posts_dummy_20_seed.sql 외 더미 포스트 시드
-- ⚠ Chrome 번역 OFF, 2회 이상 실행 금지(중복 생성)
-- ══════════════════════════════════════════

do $$
declare
  v_post record;
  v_author text;
  v_body text;
  v_hours_after int;
  v_count int;
  v_inserted int := 0;

  -- 닉네임 풀 (30개)
  nick_pool text[] := array[
    '망원 캣맘','합정 이웃','용산 집사','송파 돌보미','구의 냥친구',
    '연남 아줌마','이촌 주민','잠실 치즈집사','방배 골목지기','역삼 야근러',
    '서교 맥주장인','여의도 직장인','성수 포토그래퍼','청담 산책러','반포 엄마',
    '상수 카페주인','삼성 아침형','홍대 자취생','이태원 이웃','압구정 돌보미',
    '강동 자원봉사','노원 캣대디','양천 새벽이','금천 이웃','관악 대학생',
    '신림 캣맘','마곡 직장맘','목동 단지주민','미아 골목지기','휘경 이웃'
  ];

  -- 카테고리별 댓글 풀
  body_emergency text[] := array[
    '세상에… 너무 속상하네요. CCTV 요청 꼭 같이 해요. 주변 지인한테도 공유할게요.',
    '저도 자주 지나는 곳이에요. 오늘부터 좀 더 자주 둘러볼게요.',
    '112랑 동물보호센터(1577-0954) 같이 신고하시면 접수 빨라요. 사진·시간 꼭 남기세요.',
    '아… 읽다가 눈물 났어요. 힘내시고 혹시 제가 도울 일 있으면 쪽지 주세요.',
    '주변 급식소 위치 공유 원치 않으시면 지역만 남겨주세요. 저도 근처라 같이 찾아볼게요.',
    '오늘 새벽에도 비슷한 소리 들었던 것 같은데 착각이길 바라요… 공유 감사해요.',
    '혹시 어제 그 시간에 주변 지나간 분 계실까요? 혹시 보신 분 저한테도 쪽지 부탁해요.',
    '구조 가능한 지인 캣맘님께 전달드렸어요. 상황 업데이트 되시면 올려주세요.'
  ];

  body_foster text[] := array[
    '임보 너무 귀한 손길이에요. 사료·모래 지원 괜찮으시면 소량이라도 보내드릴게요.',
    '혹시 예방접종 여부랑 혈액검사 했는지 알 수 있을까요? 시기 맞으면 제가 받아보려고요.',
    '저희 집 공간은 있는데 기존 냥이가 예민해서 합사가 어려워서요… ㅠ 다른 분이 꼭 나타나길 응원해요.',
    '출산 임박한 아이는 정말 시급해요. 주변 공유할게요. 임보 정해지길 간절히 바랍니다.',
    '중성화·구충제 비용 공동부담 가능하신가요? 가능하면 연락드리려고요.',
    '회복 기간 교대 가능하신 분이라 하셨는데 저 3박 4일 가능해요. 쪽지 드릴게요.',
    '혹시 지역이 어디쯤이세요? 이동봉사 가능하실 수 있어서 여쭤봐요.',
    '너무 감사해요. 주변 단톡방에 바로 공유했습니다.'
  ];

  body_adoption text[] := array[
    '아이 너무 귀여워요… 혹시 남자아이인지 여자아이인지 알 수 있을까요?',
    '선주양육자분이 계신 환경 상세히 알 수 있을까요? 저는 1인 가구예요.',
    '맞선 가능할까요? 지역은 어디신가요?',
    '입양 조건에 중성화 후 책임비 있는지 미리 여쭤봐요.',
    '집에 기존 냥이 한 마리 있는데 합사 경험 있으세요?',
    '사진 너무 예쁘네요. 성격이 어떤지 더 자세히 알고 싶어요.',
    '혹시 건강검진·예방접종 내역 공유 가능한가요?',
    '매일 꼭 출근 있는 직장인이어도 가능할까요? 고민돼서요.'
  ];

  body_market text[] := array[
    '아직 거래 가능한가요? 쪽지 드릴게요.',
    '직거래 지역이 어디쯤이세요? 혹시 택배도 가능할까요?',
    '이 제품 저도 써봤는데 좋아요. 가격도 괜찮은 것 같아요.',
    '나눔이면 정말 감사해요. 필요한 분께 가면 좋겠어요.',
    '상태 사진 추가로 한 장 더 올려주실 수 있을까요?',
    '혹시 남으면 저도 받고 싶어요… 쪽지 주세요.',
    '제조일자/유통기한 확인 부탁드려요.',
    '같은 지역이라 가능하면 오늘 저녁에 받으러 가도 될까요?'
  ];

  body_free text[] := array[
    '너무 공감되네요 ㅎㅎ 우리집 애도 그래요.',
    '사진 보고 힐링하고 가요 🐾',
    '저희 동네도 비슷한 상황이에요. 이웃분들이랑 공감할 수 있어서 좋네요.',
    '좋은 정보 감사합니다. 바로 적용해볼게요.',
    '이거 정말 중요한 얘기인데 몰랐던 분들께 꼭 알려져야 할 것 같아요.',
    '저도 비슷한 경험 있어요. 나중에 글로 정리해서 올려볼게요.',
    '꾸준히 이런 기록 남겨주셔서 감사해요. 저도 오늘부터 따라해볼게요.',
    '도움 많이 됐어요. 저장해두고 자주 볼게요!'
  ];

begin
  -- 비회원 더미 포스트만 대상 (author_id IS NULL)
  for v_post in
    select id, category, title, created_at
    from public.posts
    where author_id is null
    order by created_at desc
  loop
    -- 포스트별 2~4개 랜덤 댓글
    v_count := 2 + floor(random() * 3)::int; -- 2, 3, 4

    for i in 1..v_count loop
      v_author := nick_pool[1 + floor(random() * array_length(nick_pool, 1))::int];
      v_hours_after := 1 + floor(random() * 20)::int; -- 1~20시간 뒤

      v_body := case v_post.category
        when 'emergency' then body_emergency[1 + floor(random() * array_length(body_emergency, 1))::int]
        when 'foster'    then body_foster[1 + floor(random() * array_length(body_foster, 1))::int]
        when 'adoption'  then body_adoption[1 + floor(random() * array_length(body_adoption, 1))::int]
        when 'market'    then body_market[1 + floor(random() * array_length(body_market, 1))::int]
        when 'free'      then body_free[1 + floor(random() * array_length(body_free, 1))::int]
        else body_free[1 + floor(random() * array_length(body_free, 1))::int]
      end;

      insert into public.post_comments
        (post_id, author_id, author_name, body, created_at)
      values
        (v_post.id::text, null, v_author, v_body,
         v_post.created_at + (v_hours_after || ' hours')::interval + (floor(random() * 60) || ' minutes')::interval);

      v_inserted := v_inserted + 1;
    end loop;

    -- 포스트 comment_count 동기화
    update public.posts
    set comment_count = (
      select count(*) from public.post_comments where post_id = v_post.id::text
    )
    where id = v_post.id;
  end loop;

  raise notice '총 % 개 더미 댓글 삽입 완료', v_inserted;
end $$;

-- 확인용
select p.title, p.comment_count
from public.posts p
where p.author_id is null
order by p.created_at desc
limit 10;
