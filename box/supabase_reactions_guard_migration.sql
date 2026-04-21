-- ══════════════════════════════════════════
-- reactions 테이블 무결성 강화 — orphan/임의 UUID 주입 방지
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 대상 댓글 존재 여부 검증 + 삭제 시 cascade
CREATE OR REPLACE FUNCTION public.guard_reaction_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.target_type = 'cat_comment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cat_comments WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION '존재하지 않는 댓글입니다.';
    END IF;
  ELSIF NEW.target_type = 'post_comment' THEN
    IF NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION '존재하지 않는 댓글입니다.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reaction_target ON public.reactions;
CREATE TRIGGER trg_guard_reaction_target
  BEFORE INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_reaction_target();

-- 댓글 삭제 시 해당 리액션도 삭제 (cat_comments)
CREATE OR REPLACE FUNCTION public.cascade_delete_reactions_cat()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.reactions WHERE target_type = 'cat_comment' AND target_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_reactions_cat ON public.cat_comments;
CREATE TRIGGER trg_cascade_reactions_cat
  AFTER DELETE ON public.cat_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_reactions_cat();

-- 댓글 삭제 시 해당 리액션도 삭제 (post_comments)
CREATE OR REPLACE FUNCTION public.cascade_delete_reactions_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.reactions WHERE target_type = 'post_comment' AND target_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_reactions_post ON public.post_comments;
CREATE TRIGGER trg_cascade_reactions_post
  AFTER DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_delete_reactions_post();

-- 이미 쌓인 orphan 정리
DELETE FROM public.reactions
  WHERE target_type = 'cat_comment'
    AND target_id NOT IN (SELECT id FROM public.cat_comments);
DELETE FROM public.reactions
  WHERE target_type = 'post_comment'
    AND target_id NOT IN (SELECT id FROM public.post_comments);

NOTIFY pgrst, 'reload schema';
-- 끝.
