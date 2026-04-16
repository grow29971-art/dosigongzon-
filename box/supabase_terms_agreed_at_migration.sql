-- ══════════════════════════════════════════
-- profiles 테이블이 없으면 생성 + terms_agreed_at 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- profiles 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID GENERATED ALWAYS AS (id) STORED,
  nickname TEXT,
  email TEXT,
  avatar_url TEXT,
  suspended BOOLEAN NOT NULL DEFAULT false,
  terms_agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 이미 테이블이 있는 경우 컬럼만 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ;

-- RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 읽기: 모든 사용자
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles
  FOR SELECT USING (true);

-- 쓰기: 본인만
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 삽입: 본인만
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 신규 유저 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, email, avatar_url, terms_agreed_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nickname', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE((NEW.raw_user_meta_data ->> 'terms_agreed_at')::timestamptz, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    terms_agreed_at = COALESCE(profiles.terms_agreed_at, EXCLUDED.terms_agreed_at);
  RETURN NEW;
END;
$$;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 기존 auth.users를 profiles에 동기화 (아직 없는 유저)
INSERT INTO public.profiles (id, nickname, email, terms_agreed_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'nickname', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 기존 profiles에 terms_agreed_at 채우기
UPDATE public.profiles
SET terms_agreed_at = created_at
WHERE terms_agreed_at IS NULL;

NOTIFY pgrst, 'reload schema';
-- 끝.
