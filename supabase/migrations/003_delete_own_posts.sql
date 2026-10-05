-- Assignment #4, step 3: let users delete their own posts.
-- Run in the Supabase SQL editor after 002_photo_captions.sql.

-- The earlier schema revoked DELETE on generations from signed-in users;
-- restore the privilege. RLS below still limits it to the owner's own rows.
grant delete on public.generations to authenticated;

create policy "Users can delete their own generations" on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Votes on a deleted post disappear through the existing
-- votes.generation_id ... on delete cascade foreign key.

-- Let users remove the image files in their own post-images folder (and only
-- those), so deleting a post can also delete its photo.
create policy "Users can delete their own post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
