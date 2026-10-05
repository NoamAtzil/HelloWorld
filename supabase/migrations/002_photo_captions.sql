-- Assignment #4, step 2: photo -> AI caption.
--
-- Run in the Supabase SQL editor AFTER the earlier "caption feed" section of
-- schema.sql has been applied. Run PART 1, then PART 2, then PART 3 in order.
-- Nothing here drops a table or deletes rows (PART 2 is a manual, optional
-- statement that you run yourself).

-- ---------------------------------------------------------------------------
-- PART 1 — additive and non-destructive
-- ---------------------------------------------------------------------------

-- New columns are nullable for now so existing text-only test rows survive.
alter table public.generations
  add column if not exists image_path text,
  add column if not exists model text;

-- A post's image must live in its author's own Storage folder. NOT VALID
-- skips checking old rows (their image_path is null anyway); new rows are
-- always checked.
alter table public.generations
  add constraint generations_image_path_owner_check
  check (image_path like user_id::text || '/%') not valid;

-- Private bucket for uploaded photos; 4 MB cap and image types enforced by
-- Storage itself, in addition to the checks in the server action.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images', 'post-images', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Users may upload only into a folder named after their own user id.
create policy "Users can upload their own post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Logged-in users may read post images (the feed is authenticated-only).
-- The app serves them through short-lived signed URLs; the bucket is private.
create policy "Signed-in users can view post images"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-images');

-- No UPDATE or DELETE policy on post-images: objects are immutable.

-- The Assignment #1 books policy only covered `anon`, so signed-in users
-- (role `authenticated`) saw an empty list. Cover both roles.
drop policy if exists "Public read access" on public.books;
create policy "Public read access" on public.books
  for select to anon, authenticated using (true);

-- Feed function: the return type changes (adds image_path), which
-- CREATE OR REPLACE cannot do, so drop and recreate the function. This
-- removes no data.
drop function if exists public.feed_generations();

create function public.feed_generations()
returns table (
  id bigint,
  prompt text,
  content text,
  image_path text,
  created_at timestamptz,
  score bigint,
  my_vote smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.prompt,
    g.content,
    g.image_path,
    g.created_at,
    coalesce(sum(v.value), 0)::bigint as score,
    (
      select mv.value
      from public.votes mv
      where mv.generation_id = g.id and mv.user_id = (select auth.uid())
    ) as my_vote
  from public.generations g
  left join public.votes v on v.generation_id = g.id
  where (select auth.uid()) is not null
    and g.image_path is not null
  group by g.id
  order by g.created_at desc
  limit 100;
$$;

revoke execute on function public.feed_generations() from public, anon;
grant execute on function public.feed_generations() to authenticated;

-- ---------------------------------------------------------------------------
-- PART 2 — old text-only test rows (manual decision)
-- ---------------------------------------------------------------------------
-- See how many old rows have no image:
--
--   select count(*) from public.generations where image_path is null;
--
-- If the count is 0, skip straight to PART 3. If not, these are the old
-- test captions. Either delete them (their votes cascade) by running:
--
--   delete from public.generations where image_path is null;
--
-- or leave them: they are already hidden from the feed, but PART 3 will
-- then fail until they are gone.

-- ---------------------------------------------------------------------------
-- PART 3 — make the new columns required (fails safely if old rows remain)
-- ---------------------------------------------------------------------------
-- alter table public.generations
--   alter column image_path set not null,
--   alter column model set not null;
