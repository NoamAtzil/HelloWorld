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
