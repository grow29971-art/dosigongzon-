-- ══════════════════════════════════════════
-- 도시공존 — cats 서버사이드 입력 검증 트리거
-- 원인: location/abuse 검증이 lib/cats-repo.ts 클라이언트만. Supabase REST API
--       로 직접 insert/update 호출하면 우회 가능. DB-level trigger로 백업.
-- 범위: 가장 명백한 PII·위치 식별자만 차단 (zero-width 정규화 포함).
--       세밀한 패턴은 여전히 클라이언트가 1차 가드.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

create or replace function public.cats_validate_text_input()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_text text;
  v_normalized text;
begin
  -- name + description을 한 번에 검사 (둘 다 사용자 입력)
  v_text := coalesce(new.name, '') || ' ' || coalesce(new.description, '');

  -- 1. zero-width·invisible 문자 제거 (검사 우회 방어)
  --    U+200B-U+200F, U+202A-U+202E, U+2060-U+206F, U+FEFF
  v_normalized := regexp_replace(v_text,
    '[​-‏‪-‮⁠-⁯﻿]', '', 'g');

  -- 2. PII 차단 — 전화번호 (010 + 7-8자리)
  if v_normalized ~ '01[0-9][-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4}' then
    raise exception '전화번호는 적을 수 없어요.';
  end if;

  -- 3. PII 차단 — 주민등록번호 (6-7 형태)
  if v_normalized ~ '[0-9]{6}[-\s]?[1-4][0-9]{6}' then
    raise exception '주민번호 형태가 감지됐어요.';
  end if;

  -- 4. PII 차단 — 차량번호 (12가 3456 / 123가 4567)
  if v_normalized ~ '[0-9]{2,3}\s*[가-힣]\s*[0-9]{4}' then
    raise exception '차량번호는 적을 수 없어요.';
  end if;

  -- 5. 위치 식별자 차단 — N번 출구
  if v_normalized ~ '[0-9]+\s*번\s*출구' then
    raise exception '출구 번호로 위치를 특정할 수 없어요. 일반적 표현으로 바꿔주세요.';
  end if;

  -- 6. 위치 식별자 차단 — 동·호수
  if v_normalized ~ '[0-9]+\s*동\s*[0-9]+\s*호' then
    raise exception '동·호수는 적을 수 없어요.';
  end if;

  -- 7. 명백한 위협 표현 — "고양이 죽여" 류
  if v_normalized ~ '(고양이|냥|길냥|얘들|걔들|쟤들)\s*(다|모두|싹|전부)?\s*죽\s*[여이]' then
    raise exception '부적절한 표현이 감지됐어요.';
  end if;
  if v_normalized ~ '(독약|쥐약|살서제)\s*(먹|뿌|놓|쓰|풀)' then
    raise exception '부적절한 표현이 감지됐어요.';
  end if;

  return new;
end;
$$;

drop trigger if exists cats_validate_text_input_trg on public.cats;
create trigger cats_validate_text_input_trg
  before insert or update of name, description on public.cats
  for each row
  execute function public.cats_validate_text_input();

-- 동일 정책을 cat_comments에도 적용 (body 한정)
create or replace function public.cat_comments_validate_body()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_normalized text;
begin
  if new.body is null then return new; end if;
  v_normalized := regexp_replace(new.body,
    '[​-‏‪-‮⁠-⁯﻿]', '', 'g');

  if v_normalized ~ '01[0-9][-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4}' then
    raise exception '전화번호는 적을 수 없어요.';
  end if;
  if v_normalized ~ '[0-9]{6}[-\s]?[1-4][0-9]{6}' then
    raise exception '주민번호 형태가 감지됐어요.';
  end if;
  if v_normalized ~ '(고양이|냥|길냥|얘들)\s*(다|모두|싹|전부)?\s*죽\s*[여이]' then
    raise exception '부적절한 표현이 감지됐어요.';
  end if;
  if v_normalized ~ '(독약|쥐약|살서제)\s*(먹|뿌|놓|쓰|풀)' then
    raise exception '부적절한 표현이 감지됐어요.';
  end if;

  return new;
end;
$$;

drop trigger if exists cat_comments_validate_body_trg on public.cat_comments;
create trigger cat_comments_validate_body_trg
  before insert or update of body on public.cat_comments
  for each row
  execute function public.cat_comments_validate_body();

-- 동일 정책을 post_comments에도 적용
drop trigger if exists post_comments_validate_body_trg on public.post_comments;
create trigger post_comments_validate_body_trg
  before insert or update of body on public.post_comments
  for each row
  execute function public.cat_comments_validate_body();

-- direct_messages는 본인 → 특정 수신자 사적 메시지라 PII 누설 위험 다른 결.
-- 그러나 위협·동물 학대 표현은 동일 차단.
drop trigger if exists direct_messages_validate_body_trg on public.direct_messages;
create trigger direct_messages_validate_body_trg
  before insert or update of body on public.direct_messages
  for each row
  execute function public.cat_comments_validate_body();

-- circle_messages도 동일
drop trigger if exists circle_messages_validate_body_trg on public.circle_messages;
create trigger circle_messages_validate_body_trg
  before insert or update of body on public.circle_messages
  for each row
  execute function public.cat_comments_validate_body();

notify pgrst, 'reload schema';
