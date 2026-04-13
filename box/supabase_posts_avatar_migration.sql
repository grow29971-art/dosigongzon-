alter table public.posts
  add column if not exists author_avatar_url text;
notify pgrst, 'reload schema';
