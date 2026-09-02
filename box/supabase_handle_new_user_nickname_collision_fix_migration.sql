-- ══════════════════════════════════════════════════════════════
-- 가입 실패 픽스: handle_new_user 닉네임 충돌 회피 (2026-09-02)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
--
-- 증상: auth_error_logs에 "Database error saving new user" 12건
--   (전부 2026-09-02 13:49~14:26 KST, 유입 급증 시간대. 90일 내 최초 발생)
-- 원인: 8/27 카드제거 SQL이 profiles_nickname_unique_idx(lower(nickname))를
--   추가했는데, on_auth_user_created 트리거(handle_new_user)는 카카오 실명/
--   프로필명을 그대로 nickname에 INSERT한다. 기존 유저와 이름이 겹치면
--   unique 위반 → 트리거 실패 → auth.users INSERT까지 롤백 → 가입 자체 불가.
--   같은 사람이 재시도해도 이름이 같아 영구 실패한다.
-- 수정: 충돌 시 숫자/uuid 접미사로 회피. (가입 후 콜백이 generateNickname으로
--   덮어쓰므로 이 임시 닉네임은 잠깐만 존재)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  early_title TEXT;
  base_nick TEXT;
  final_nick TEXT;
  n INT := 1;
BEGIN
  -- early_supporter 로직은 기존(early_supporter_title.sql)과 동일하게 유지
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count < 100 THEN
    early_title := 'early_supporter';
  ELSE
    early_title := NULL;
  END IF;

  base_nick := COALESCE(
    NEW.raw_user_meta_data ->> 'nickname',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );
  final_nick := base_nick;

  -- profiles_nickname_unique_idx(lower(nickname)) 충돌 회피: 숫자 접미사
  WHILE final_nick IS NOT NULL AND n <= 20 AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(nickname) = lower(final_nick) AND id <> NEW.id
  ) LOOP
    n := n + 1;
    final_nick := base_nick || n;
  END LOOP;

  INSERT INTO public.profiles (id, nickname, email, avatar_url, terms_agreed_at, admin_title)
  VALUES (
    NEW.id,
    final_nick,
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE((NEW.raw_user_meta_data ->> 'terms_agreed_at')::timestamptz, now()),
    early_title
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    terms_agreed_at = COALESCE(profiles.terms_agreed_at, EXCLUDED.terms_agreed_at),
    admin_title = COALESCE(profiles.admin_title, EXCLUDED.admin_title);
  RETURN NEW;

EXCEPTION WHEN unique_violation THEN
  -- 동시 가입 레이스 등 그래도 충돌하면: uuid 앞 6자리 접미사(사실상 유일)로 최종 회피.
  -- 가입 자체가 실패하는 것보다 임시 닉네임이 낫다.
  INSERT INTO public.profiles (id, nickname, email, avatar_url, terms_agreed_at, admin_title)
  VALUES (
    NEW.id,
    COALESCE(base_nick, '길집사') || '_' || substr(NEW.id::text, 1, 6),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE((NEW.raw_user_meta_data ->> 'terms_agreed_at')::timestamptz, now()),
    early_title
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ── 검증 (실행 후) ──
-- 1) select proname from pg_proc where proname = 'handle_new_user';  → 1행
-- 2) 기존 유저와 같은 카카오 이름으로 신규 가입 시도 → 성공해야 함
--    (auth_error_logs에 "Database error saving new user" 신규 발생 없어야 함)
-- 3) select nickname, count(*) from profiles group by 1 having count(*) > 1;  → 0행 유지

-- ── 롤백 ──
-- 이전 버전 함수로 되돌리려면 box/supabase_early_supporter_title.sql 의
-- CREATE OR REPLACE FUNCTION public.handle_new_user() 블록(15~46행)을 재실행.
-- (트리거 on_auth_user_created 자체는 건드리지 않으므로 함수 교체만으로 복원됨)
-- 끝.
