create table if not exists public.books (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null,
  year int
);

alter table public.books enable row level security;

create policy "Public read access" on public.books
  for select to anon using (true);

insert into public.books (title, author, year) values
  ('The Hitchhiker''s Guide to the Galaxy', 'Douglas Adams', 1979),
  ('Good Omens', 'Terry Pratchett & Neil Gaiman', 1990),
  ('Catch-22', 'Joseph Heller', 1961),
  ('Three Men in a Boat', 'Jerome K. Jerome', 1889);

-- Assignment #3: Google auth + profiles
--
-- (Assignment #3 left RLS off on profiles; Assignment #4 enables it below.)
-- Later changes live in supabase/migrations/ (see 002_photo_captions.sql).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- Automatically creates a blank profile row the moment a user first signs in.
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Storage bucket for profile photos. Public so avatar images can be
-- displayed via a plain URL; the relational table only stores that URL,
-- never the image bytes.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- `owner` is deprecated and no longer auto-populated by Storage; use
-- `owner_id` (text) instead. See:
-- https://supabase.com/docs/guides/storage/security/ownership
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

-- The app uploads with `upsert: true`, which makes Storage check whether the
-- object already exists before deciding insert vs. update — that check is a
-- SELECT, and without a policy for it, RLS blocks the upsert entirely even
-- for the correct owner. See "Policy examples" at:
-- https://supabase.com/docs/guides/storage/security/access-control
create policy "Users can view their own avatar"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));

-- Assignment #4: caption feed
--
-- RLS is enabled on every app table. Users only ever see and change their own
-- rows directly. Browsing other users' captions and their vote totals goes
-- through feed_generations() below, which returns aggregated data only.

alter table public.profiles enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 200),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "Users can view their own generations" on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own generations" on public.generations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.generations from anon;
revoke update, delete on public.generations from authenticated;

create table if not exists public.votes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_id bigint not null references public.generations (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, generation_id)
);

alter table public.votes enable row level security;

create policy "Users can view their own votes" on public.votes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own votes" on public.votes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own votes" on public.votes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own votes" on public.votes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.votes from anon;

-- Feed query: every generation with its score and the caller's own vote.
-- SECURITY DEFINER lets it sum all votes without exposing other users' vote
-- rows; the auth.uid() check makes it useless to anonymous callers.
create or replace function public.feed_generations()
returns table (
  id bigint,
  prompt text,
  content text,
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
  group by g.id
  order by g.created_at desc
  limit 100;
$$;

revoke execute on function public.feed_generations() from public, anon;
grant execute on function public.feed_generations() to authenticated;
