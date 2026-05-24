-- ══════════════════════════════════════════
-- cat_style_transforms — style check constraint에 'custom' 추가
-- 사용자 직접 프롬프트 모드 활성용. 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.cat_style_transforms
  drop constraint if exists cat_style_transforms_style_check;

alter table public.cat_style_transforms
  add constraint cat_style_transforms_style_check
  check (style in ('anime','watercolor','embroidery','sticker','custom'));

notify pgrst, 'reload schema';
-- 끝.
