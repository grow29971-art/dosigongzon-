-- ══════════════════════════════════════════
-- 커뮤니티 카테고리별 공지사항 시드
-- 실행 위치: Supabase Dashboard → SQL Editor (service_role)
-- 선행: supabase_posts_migration.sql
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- admin user_id 가져오기
do $$
declare
  admin_id uuid;
begin
  select id into admin_id
  from auth.users
  where lower(email) = lower('grow29971@gmail.com')
  limit 1;

  if admin_id is null then
    raise notice 'admin 계정을 찾을 수 없어요. author_id를 null로 설정합니다.';
  end if;

  -- ── 긴급 ──
  insert into public.posts (category, title, content, author_id, author_name, is_pinned, images)
  values (
    'emergency',
    '🚨 긴급 게시판 이용 안내',
    E'이 게시판은 길고양이의 생명이 위급한 상황에서 빠르게 도움을 요청하는 공간입니다.\n\n📌 이런 글을 올려주세요\n• 학대 목격 제보 (사진/영상/장소/시간)\n• 교통사고·부상 고양이 긴급 구조 요청\n• 실종 고양이 목격 제보\n• 유기·방치 신고\n\n⚠️ 주의사항\n• 허위 신고는 다른 고양이에게 돌아갈 자원을 낭비합니다\n• 학대 목격 시 경찰 112, 동물보호콜센터 1577-0954에 먼저 신고해주세요\n• 사진 속 개인정보(차량번호, 얼굴 등)는 가려주세요\n• 위치는 가능한 구체적으로 (○○구 ○○동 ○○ 앞)',
    admin_id,
    '도시공존 운영팀',
    true,
    '{}'
  );

  -- ── 임보 ──
  insert into public.posts (category, title, content, author_id, author_name, is_pinned, images)
  values (
    'foster',
    '🏠 임시보호 게시판 이용 안내',
    E'임시보호가 필요하거나 임보를 제안하는 공간입니다.\n\n📌 임보 요청 글 작성 시 포함해주세요\n• 고양이 상태 (나이 추정, 건강, 성격)\n• 구조 경위와 현재 위치\n• 필요한 임보 기간\n• 중성화/예방접종 여부\n• 연락 방법\n\n📌 임보 제안 글 작성 시\n• 가능한 임보 기간\n• 주거 환경 (반려동물 유무, 발코니 등)\n• 경험 여부\n\n💡 임보는 입양이 아닌 임시 보호입니다. 최종 입양처가 정해질 때까지 안전하게 돌보는 것이 목적이에요.',
    admin_id,
    '도시공존 운영팀',
    true,
    '{}'
  );

  -- ── 입양 ──
  insert into public.posts (category, title, content, author_id, author_name, is_pinned, images)
  values (
    'adoption',
    '💕 입양 게시판 이용 안내',
    E'새 가족을 찾는 고양이와 입양을 원하는 분들을 위한 공간입니다.\n\n📌 입양 보내기 글 작성 시 포함해주세요\n• 이름, 나이(추정), 성별, 품종\n• 성격과 특이사항\n• 중성화·예방접종·건강검진 여부\n• 사진 (정면, 전신)\n• 입양 조건 (있다면)\n\n📌 입양 희망 글 작성 시\n• 주거 환경과 가족 구성\n• 반려동물 경험\n• 원하는 고양이 조건\n\n⚠️ 주의사항\n• 판매·거래 목적 글은 금지됩니다\n• 입양 후 파양 방지를 위해 충분히 고민해주세요\n• 입양 사기 의심 시 신고해주세요',
    admin_id,
    '도시공존 운영팀',
    true,
    '{}'
  );

  -- ── 중고마켓 ──
  insert into public.posts (category, title, content, author_id, author_name, is_pinned, images)
  values (
    'market',
    '🛍️ 중고마켓 이용 안내',
    E'고양이 용품을 거래하거나 무료로 나누는 공간입니다.\n\n📌 거래 글 작성 시 포함해주세요\n• 물품명과 상태 (사용 기간, 하자 유무)\n• 가격 (무료 나눔이면 명시)\n• 거래 방법 (직거래/택배)\n• 거래 가능 지역\n• 사진 (실물)\n\n⚠️ 주의사항\n• 동물 자체의 판매·거래는 금지됩니다\n• 안전한 직거래 장소를 이용해주세요\n• 사기 의심 거래는 즉시 신고해주세요\n• 유통기한이 지난 사료·간식 나눔은 삼가주세요',
    admin_id,
    '도시공존 운영팀',
    true,
    '{}'
  );

  -- ── 자유게시판 ──
  insert into public.posts (category, title, content, author_id, author_name, is_pinned, images)
  values (
    'free',
    '💬 자유게시판 이용 안내',
    E'길고양이와 관련된 일상, 정보, 수다를 자유롭게 나누는 공간입니다.\n\n📌 이런 이야기를 나눠요\n• 오늘 만난 동네 고양이 이야기\n• 길고양이 돌봄 노하우 공유\n• TNR 정보, 병원 추천\n• 길고양이 관련 뉴스·법률 정보\n• 기타 자유로운 대화\n\n⚠️ 커뮤니티 규칙\n• 서로 존중하는 대화를 부탁드려요\n• 학대 조장·혐오 발언은 즉시 제재됩니다\n• 광고·스팸은 신고 대상입니다\n• 다른 이웃의 개인정보를 노출하지 마세요',
    admin_id,
    '도시공존 운영팀',
    true,
    '{}'
  );

end $$;

-- 끝.
