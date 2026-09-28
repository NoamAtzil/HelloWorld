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
-- RLS is intentionally left off on profiles per the assignment brief. Reads
-- and writes are gated in the app by the authenticated user's session
-- (server-side, via Supabase Auth), not by database policies.
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
