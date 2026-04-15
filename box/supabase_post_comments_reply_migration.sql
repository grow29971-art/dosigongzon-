-- 대댓글 지원을 위한 parent_id 컬럼 추가
ALTER TABLE public.post_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;
