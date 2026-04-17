-- ══════════════════════════════════════════
-- 초기 서포터 타이틀 (100명까지)
-- 1. 기존 가입자 전원에게 부여
-- 2. 신규 가입 트리거에서 100명까지 자동 부여
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 기존 가입자 전원 부여
UPDATE public.profiles
SET admin_title = 'early_supporter'
WHERE admin_title IS NULL;

-- 신규 가입 트리거 업데이트: 100명까지 초기 서포터 자동 부여
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INT;
  early_title TEXT;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count < 100 THEN
    early_title := 'early_supporter';
  ELSE
    early_title := NULL;
  END IF;

  INSERT INTO public.profiles (id, nickname, email, avatar_url, terms_agreed_at, admin_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nickname', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
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
END;
$$;

NOTIFY pgrst, 'reload schema';
-- 끝.
