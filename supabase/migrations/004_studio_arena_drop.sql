-- Studio, Arena, Daily Drop, Hall of Fame and quotas.
--
-- DO NOT RUN until reviewed. Run ONCE in the Supabase SQL editor of the shared
-- project, after 002/003 (and after the admin app's 001). It is additive and
-- safe to re-run: nothing is dropped, no row is deleted or changed, and no
-- existing table policy is modified.
--
-- What it adds
--   1. Guest + signed-in AI quotas, enforced in the database
--      (private.app_settings, private.ai_usage, consume_guest_quota,
--       consume_user_quota).
--   2. generations: voice, library_slug, is_public (default FALSE, so every
--      historical post stays exactly as private as it is today) and drop_date.
--   3. Daily Drop: drop_today(), daily_challenges, one-entry-per-day and
--      "today only / not your own entry" voting rules (triggers).
--   4. Arena: duel_votes (append-only, one vote per pair per person) and the
--      functions arena_next_pair() / arena_vote().
--   5. Read functions: feed_posts, my_captions, drop_entries, drop_winner,
--      drop_winners, hall_*; and for logged-out visitors ONLY
--      public_showcase / public_post / drop_summary, which return posts the
--      author explicitly shared (is_public = true).
--   6. A PUBLIC storage bucket "shared-images" holding copies of images the
--      author chose to share. The private "post-images" bucket and its policies
--      are untouched.
--
-- Not done here (see 004 notes in the report): nothing makes any existing post
-- public; nothing changes any existing RLS policy.

-- ---------------------------------------------------------------------------
-- 0. Private schema for settings and counters (not exposed by the API)
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

-- Tunable limits (change them with a plain UPDATE, no deploy needed). The
-- quota_secret is NOT inserted here: you set it yourself (see section 8).
insert into private.app_settings (key, value) values
  ('guest_per_visitor_daily', '3'),
  ('guest_global_daily', '100'),
  ('user_daily', '30'),
  ('global_daily', '400')
on conflict (key) do nothing;

create table if not exists private.ai_usage (
  day date not null,
  scope text not null check (scope in ('guest_visitor', 'guest_total', 'user', 'total')),
  subject text not null,
  calls integer not null default 0,
  primary key (day, scope, subject)
);

alter table private.app_settings enable row level security;
alter table private.ai_usage enable row level security;

create or replace function private.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value::integer from private.app_settings s where s.key = p_key), p_default);
$$;

-- Atomically add one call to a counter unless it is already at its limit.
create or replace function private.take_quota(p_scope text, p_subject text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calls integer;
begin
  if p_limit < 1 then
    return false;
  end if;
  insert into private.ai_usage as u (day, scope, subject, calls)
  values ((now() at time zone 'utc')::date, p_scope, p_subject, 1)
  on conflict (day, scope, subject)
  do update set calls = u.calls + 1 where u.calls < p_limit
  returning u.calls into v_calls;
  return v_calls is not null;
end;
$$;

create or replace function private.give_back(p_scope text, p_subject text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.ai_usage
     set calls = greatest(calls - 1, 0)
   where day = (now() at time zone 'utc')::date and scope = p_scope and subject = p_subject;
$$;

revoke execute on function private.setting_int(text, integer) from public, anon, authenticated;
revoke execute on function private.take_quota(text, text, integer) from public, anon, authenticated;
revoke execute on function private.give_back(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Quotas
-- ---------------------------------------------------------------------------

-- Called by the Next.js server (with the public anon key) before every guest
-- AI call. The caller must present the shared secret, so nobody who merely
-- knows the anon key can burn the budget. Fails closed when the secret is not
-- configured. Returns {allowed, remaining, reason}.
create or replace function public.consume_guest_quota(p_secret text, p_visitor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_per integer := private.setting_int('guest_per_visitor_daily', 3);
  v_guest integer := private.setting_int('guest_global_daily', 100);
  v_all integer := private.setting_int('global_daily', 400);
  v_used integer;
begin
  select s.value into v_secret from private.app_settings s where s.key = 'quota_secret';
  if v_secret is null or char_length(v_secret) < 24 or p_secret is distinct from v_secret
     or p_visitor is null or char_length(p_visitor) not between 16 and 128 then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'unavailable');
  end if;

  if not private.take_quota('total', '*', v_all) then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'busy');
  end if;
  if not private.take_quota('guest_total', '*', v_guest) then
    perform private.give_back('total', '*');
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'busy');
  end if;
  if not private.take_quota('guest_visitor', p_visitor, v_per) then
    perform private.give_back('total', '*');
    perform private.give_back('guest_total', '*');
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'visitor_limit');
  end if;

  select u.calls into v_used from private.ai_usage u
   where u.day = (now() at time zone 'utc')::date and u.scope = 'guest_visitor' and u.subject = p_visitor;
  return jsonb_build_object('allowed', true, 'remaining', greatest(v_per - coalesce(v_used, 0), 0), 'reason', null);
end;
$$;

revoke execute on function public.consume_guest_quota(text, text) from public;
grant execute on function public.consume_guest_quota(text, text) to anon, authenticated;

-- Signed-in users: a per-user daily allowance plus the shared global ceiling.
-- Also gated by the server secret, so a member cannot call this directly over
-- the API to burn the shared budget; only the app server can spend it.
create or replace function public.consume_user_quota(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_secret text;
  v_per integer := private.setting_int('user_daily', 30);
  v_all integer := private.setting_int('global_daily', 400);
  v_used integer;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'auth');
  end if;
  select s.value into v_secret from private.app_settings s where s.key = 'quota_secret';
  if v_secret is null or char_length(v_secret) < 24 or p_secret is distinct from v_secret then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'unavailable');
  end if;
  if not private.take_quota('total', '*', v_all) then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'busy');
  end if;
  if not private.take_quota('user', v_uid::text, v_per) then
    perform private.give_back('total', '*');
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'user_limit');
  end if;
  select u.calls into v_used from private.ai_usage u
   where u.day = (now() at time zone 'utc')::date and u.scope = 'user' and u.subject = v_uid::text;
  return jsonb_build_object('allowed', true, 'remaining', greatest(v_per - coalesce(v_used, 0), 0), 'reason', null);
end;
$$;

revoke execute on function public.consume_user_quota(text) from public, anon;
grant execute on function public.consume_user_quota(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. New columns on generations (all optional; historical rows stay private)
-- ---------------------------------------------------------------------------

alter table public.generations
  add column if not exists voice text,
  add column if not exists library_slug text,
  add column if not exists is_public boolean not null default false,
  add column if not exists drop_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'generations_voice_format') then
    alter table public.generations
      add constraint generations_voice_format check (voice ~ '^[a-z][a-z-]{0,23}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generations_slug_format') then
    alter table public.generations
      add constraint generations_slug_format check (library_slug ~ '^[A-Za-z0-9._-]{1,120}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generations_image_path_shape') then
    alter table public.generations
      add constraint generations_image_path_shape
      check (image_path is null or (image_path ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,100}$' and image_path !~ '\.\.'))
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generations_drop_needs_slug') then
    alter table public.generations
      add constraint generations_drop_needs_slug check (drop_date is null or library_slug is not null);
  end if;
end $$;

create index if not exists generations_library_slug_idx on public.generations (library_slug) where library_slug is not null;
create index if not exists generations_drop_date_idx on public.generations (drop_date) where drop_date is not null;
create index if not exists generations_public_idx on public.generations (created_at desc) where is_public;
-- One Daily Drop entry per person per day.
create unique index if not exists generations_one_drop_entry_per_user
  on public.generations (user_id, drop_date) where drop_date is not null;

-- ---------------------------------------------------------------------------
-- 3. Daily Drop
-- ---------------------------------------------------------------------------

-- The single clock for the Drop. America/New_York, so the day turns over at
-- local midnight there. The app uses the same zone.
create or replace function public.drop_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

revoke execute on function public.drop_today() from public;
grant execute on function public.drop_today() to anon, authenticated;

-- Optional overrides. With no row for a date, the app picks the day's image
-- deterministically from the library. Admins write rows through a function in
-- the admin migration; nobody else can write.
create table if not exists public.daily_challenges (
  drop_date date primary key,
  library_slug text not null check (library_slug ~ '^[A-Za-z0-9._-]{1,120}$'),
  theme text check (theme is null or char_length(theme) <= 80),
  created_at timestamptz not null default now()
);

alter table public.daily_challenges enable row level security;

drop policy if exists "Anyone can read daily challenges" on public.daily_challenges;
create policy "Anyone can read daily challenges" on public.daily_challenges
  for select to anon, authenticated using (true);

revoke all on public.daily_challenges from anon, authenticated;
grant select on public.daily_challenges to anon, authenticated;

-- A Drop entry can only be created for today.
create or replace function public.check_generation_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.drop_date is not null and new.drop_date <> public.drop_today() then
    raise exception 'daily drop entries can only be made for today' using errcode = '22023';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists check_generation_insert on public.generations;
create trigger check_generation_insert
  before insert on public.generations
  for each row execute function public.check_generation_insert();

revoke execute on function public.check_generation_insert() from public, anon, authenticated;

-- Votes on Drop entries: only on today's entries and never on your own.
-- Votes on every other post behave exactly as before.
create or replace function public.check_drop_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_date date;
begin
  -- A vote can never be moved to another post or person (it would let someone
  -- quietly pull a vote out of a finished Drop). The app never does this.
  if tg_op = 'UPDATE'
     and (new.generation_id <> old.generation_id or new.user_id <> old.user_id) then
    raise exception 'a vote cannot be moved to another post' using errcode = '22023';
  end if;
  -- Timestamps are the server's, not the client's (they break ties and bound
  -- the Hall of Fame windows).
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;

  select g.user_id, g.drop_date into v_owner, v_date
    from public.generations g
   where g.id = coalesce(new.generation_id, old.generation_id);

  if v_date is not null then
    if v_date <> public.drop_today() then
      raise exception 'voting for that daily drop is closed' using errcode = '22023';
    end if;
    if tg_op <> 'DELETE' and v_owner = new.user_id then
      raise exception 'you cannot vote on your own daily drop entry' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists check_drop_vote on public.votes;
create trigger check_drop_vote
  before insert or update or delete on public.votes
  for each row execute function public.check_drop_vote();

revoke execute on function public.check_drop_vote() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Arena
-- ---------------------------------------------------------------------------

create table if not exists public.duel_votes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  winner_id bigint not null references public.generations (id) on delete cascade,
  loser_id bigint not null references public.generations (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);

-- One vote per person per pair, whichever side won.
create unique index if not exists duel_votes_one_per_pair
  on public.duel_votes (user_id, least(winner_id, loser_id), greatest(winner_id, loser_id));
create index if not exists duel_votes_winner_idx on public.duel_votes (winner_id);
create index if not exists duel_votes_loser_idx on public.duel_votes (loser_id);

alter table public.duel_votes enable row level security;

drop policy if exists "Users can view their own duel votes" on public.duel_votes;
create policy "Users can view their own duel votes" on public.duel_votes
  for select to authenticated using ((select auth.uid()) = user_id);

-- Duel votes are written only by arena_vote() and are never edited or removed.
revoke all on public.duel_votes from anon;
revoke all on public.duel_votes from authenticated;
grant select on public.duel_votes to authenticated;

-- Two captions to judge. Prefers two captions on the SAME library photo; falls
-- back to any two posts when none are left. Never your own posts, never a pair
-- you already judged. Authors are not returned (revealed after the vote).
create or replace function public.arena_next_pair()
returns table (
  side integer,
  id bigint,
  content text,
  image_path text,
  voice text,
  library_slug text,
  same_image boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a bigint;
  v_b bigint;
  v_same boolean := true;
begin
  if v_uid is null then
    return;
  end if;

  -- 1. Same photo.
  select a.id into v_a
    from public.generations a
   where a.library_slug is not null and a.image_path is not null and a.user_id <> v_uid
     and exists (
       select 1 from public.generations b
        where b.library_slug = a.library_slug and b.id <> a.id and b.image_path is not null
          and b.user_id <> v_uid and b.user_id <> a.user_id
          and not exists (
            select 1 from public.duel_votes d
             where d.user_id = v_uid
               and least(d.winner_id, d.loser_id) = least(a.id, b.id)
               and greatest(d.winner_id, d.loser_id) = greatest(a.id, b.id)))
   order by random() limit 1;

  if v_a is not null then
    select b.id into v_b
      from public.generations b, public.generations a
     where a.id = v_a and b.library_slug = a.library_slug and b.id <> a.id and b.image_path is not null
       and b.user_id <> v_uid and b.user_id <> a.user_id
       and not exists (
         select 1 from public.duel_votes d
          where d.user_id = v_uid
            and least(d.winner_id, d.loser_id) = least(a.id, b.id)
            and greatest(d.winner_id, d.loser_id) = greatest(a.id, b.id))
     order by random() limit 1;
  else
    -- 2. Any two posts by different people.
    v_same := false;
    select a.id into v_a
      from public.generations a
     where a.image_path is not null and a.user_id <> v_uid
       and exists (
         select 1 from public.generations b
          where b.id <> a.id and b.image_path is not null and b.user_id <> v_uid and b.user_id <> a.user_id
            and not exists (
              select 1 from public.duel_votes d
               where d.user_id = v_uid
                 and least(d.winner_id, d.loser_id) = least(a.id, b.id)
                 and greatest(d.winner_id, d.loser_id) = greatest(a.id, b.id)))
     order by random() limit 1;
    if v_a is not null then
      select b.id into v_b
        from public.generations b, public.generations a
       where a.id = v_a and b.id <> a.id and b.image_path is not null
         and b.user_id <> v_uid and b.user_id <> a.user_id
         and not exists (
           select 1 from public.duel_votes d
            where d.user_id = v_uid
              and least(d.winner_id, d.loser_id) = least(a.id, b.id)
              and greatest(d.winner_id, d.loser_id) = greatest(a.id, b.id))
       order by random() limit 1;
    end if;
  end if;

  if v_a is null or v_b is null then
    return;
  end if;

  -- Randomise which caption appears on the left.
  if random() < 0.5 then
    select v_a, v_b into v_a, v_b;
  else
    select v_b, v_a into v_a, v_b;
  end if;

  return query
    select s.side, g.id, g.content, g.image_path, g.voice, g.library_slug, v_same
      from (values (1, v_a), (2, v_b)) as s(side, gid)
      join public.generations g on g.id = s.gid
     order by s.side;
end;
$$;

revoke execute on function public.arena_next_pair() from public, anon;
grant execute on function public.arena_next_pair() to authenticated;

-- Record one vote and return the reveal: who wrote each caption, which voice,
-- and the real tallies (including this vote).
create or replace function public.arena_vote(p_winner bigint, p_loser bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_w public.generations;
  v_l public.generations;
  v_pair_total integer;
  v_pair_winner integer;
begin
  if v_uid is null then
    raise exception 'sign in to vote' using errcode = '42501';
  end if;
  if p_winner is null or p_loser is null or p_winner = p_loser then
    raise exception 'invalid pair' using errcode = '22023';
  end if;

  select * into v_w from public.generations where id = p_winner and image_path is not null;
  select * into v_l from public.generations where id = p_loser and image_path is not null;
  if v_w.id is null or v_l.id is null then
    raise exception 'caption not found' using errcode = 'P0002';
  end if;
  if v_w.user_id = v_uid or v_l.user_id = v_uid then
    raise exception 'you cannot judge your own caption' using errcode = '42501';
  end if;

  begin
    insert into public.duel_votes (user_id, winner_id, loser_id) values (v_uid, p_winner, p_loser);
  exception when unique_violation then
    raise exception 'you already judged this pair' using errcode = '23505';
  end;

  select count(*), count(*) filter (where d.winner_id = p_winner)
    into v_pair_total, v_pair_winner
    from public.duel_votes d
   where least(d.winner_id, d.loser_id) = least(p_winner, p_loser)
     and greatest(d.winner_id, d.loser_id) = greatest(p_winner, p_loser);

  return jsonb_build_object(
    'pair_total', v_pair_total,
    'pair_winner_votes', v_pair_winner,
    'winner', (select jsonb_build_object(
        'id', g.id, 'voice', g.voice,
        'author', coalesce(nullif(trim(p.first_name), ''), 'Someone'),
        'wins', (select count(*) from public.duel_votes d where d.winner_id = g.id),
        'battles', (select count(*) from public.duel_votes d where g.id in (d.winner_id, d.loser_id)))
      from public.generations g left join public.profiles p on p.id = g.user_id where g.id = p_winner),
    'loser', (select jsonb_build_object(
        'id', g.id, 'voice', g.voice,
        'author', coalesce(nullif(trim(p.first_name), ''), 'Someone'),
        'wins', (select count(*) from public.duel_votes d where d.winner_id = g.id),
        'battles', (select count(*) from public.duel_votes d where g.id in (d.winner_id, d.loser_id)))
      from public.generations g left join public.profiles p on p.id = g.user_id where g.id = p_loser)
  );
end;
$$;

revoke execute on function public.arena_vote(bigint, bigint) from public, anon;
grant execute on function public.arena_vote(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reads for signed-in users
-- ---------------------------------------------------------------------------

-- The feed, with the new fields. feed_generations() stays as it was.
create or replace function public.feed_posts()
returns table (
  id bigint,
  prompt text,
  content text,
  image_path text,
  created_at timestamptz,
  score bigint,
  my_vote smallint,
  voice text,
  is_public boolean,
  drop_date date,
  author_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id, g.prompt, g.content, g.image_path, g.created_at,
    coalesce(sum(v.value), 0)::bigint as score,
    (select mv.value from public.votes mv
      where mv.generation_id = g.id and mv.user_id = (select auth.uid())) as my_vote,
    g.voice, g.is_public, g.drop_date,
    coalesce(nullif(trim(p.first_name), ''), 'Someone') as author_name
  from public.generations g
  left join public.votes v on v.generation_id = g.id
  left join public.profiles p on p.id = g.user_id
  where (select auth.uid()) is not null and g.image_path is not null
  group by g.id, p.first_name
  order by g.created_at desc
  limit 100;
$$;

revoke execute on function public.feed_posts() from public, anon;
grant execute on function public.feed_posts() to authenticated;

-- Everything about the caller's own posts, including real Arena results.
create or replace function public.my_captions()
returns table (
  id bigint,
  content text,
  prompt text,
  image_path text,
  voice text,
  is_public boolean,
  drop_date date,
  created_at timestamptz,
  score bigint,
  upvotes bigint,
  downvotes bigint,
  arena_wins bigint,
  arena_battles bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id, g.content, g.prompt, g.image_path, g.voice, g.is_public, g.drop_date, g.created_at,
    coalesce((select sum(v.value) from public.votes v where v.generation_id = g.id), 0)::bigint,
    (select count(*) from public.votes v where v.generation_id = g.id and v.value = 1),
    (select count(*) from public.votes v where v.generation_id = g.id and v.value = -1),
    (select count(*) from public.duel_votes d where d.winner_id = g.id),
    (select count(*) from public.duel_votes d where g.id in (d.winner_id, d.loser_id))
  from public.generations g
  where g.user_id = (select auth.uid()) and g.image_path is not null
  order by g.created_at desc
  limit 200;
$$;

revoke execute on function public.my_captions() from public, anon;
grant execute on function public.my_captions() to authenticated;

-- Today's (or an earlier day's) Drop entries with live scores.
create or replace function public.drop_entries(p_date date)
returns table (
  id bigint,
  content text,
  image_path text,
  voice text,
  created_at timestamptz,
  score bigint,
  my_vote smallint,
  mine boolean,
  author_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id, g.content, g.image_path, g.voice, g.created_at,
    coalesce(sum(v.value), 0)::bigint,
    (select mv.value from public.votes mv
      where mv.generation_id = g.id and mv.user_id = (select auth.uid())),
    g.user_id = (select auth.uid()),
    coalesce(nullif(trim(p.first_name), ''), 'Someone')
  from public.generations g
  left join public.votes v on v.generation_id = g.id
  left join public.profiles p on p.id = g.user_id
  where (select auth.uid()) is not null and g.drop_date = p_date and g.image_path is not null
  group by g.id, p.first_name
  order by coalesce(sum(v.value), 0) desc, g.created_at asc
  limit 100;
$$;

revoke execute on function public.drop_entries(date) from public, anon;
grant execute on function public.drop_entries(date) to authenticated;

-- A finished day's winner. Only days before today, only with a positive score,
-- ties go to the earlier entry. No winner is invented for an empty day.
create or replace function public.drop_winners(p_limit integer default 7)
returns table (
  drop_date date,
  id bigint,
  content text,
  image_path text,
  voice text,
  score bigint,
  author_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select distinct on (g.drop_date)
      g.drop_date, g.id, g.content, g.image_path, g.voice,
      coalesce(sum(v.value), 0)::bigint as score,
      coalesce(nullif(trim(p.first_name), ''), 'Someone') as author_name
    from public.generations g
    left join public.votes v on v.generation_id = g.id
    left join public.profiles p on p.id = g.user_id
    where (select auth.uid()) is not null
      and g.drop_date is not null and g.drop_date < public.drop_today() and g.image_path is not null
    group by g.id, p.first_name
    having coalesce(sum(v.value), 0) > 0
    order by g.drop_date desc, coalesce(sum(v.value), 0) desc, g.created_at asc
  ) w
  order by w.drop_date desc
  limit least(greatest(coalesce(p_limit, 7), 1), 60);
$$;

revoke execute on function public.drop_winners(integer) from public, anon;
grant execute on function public.drop_winners(integer) to authenticated;

-- Hall of Fame. p_days = 0 means all time. Only positive results are listed.
create or replace function public.hall_top_captions(p_days integer default 0)
returns table (
  id bigint, content text, image_path text, voice text,
  author_name text, score bigint, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.content, g.image_path, g.voice,
         coalesce(nullif(trim(p.first_name), ''), 'Someone'),
         sum(v.value)::bigint as score, g.created_at
    from public.generations g
    join public.votes v on v.generation_id = g.id
    left join public.profiles p on p.id = g.user_id
   where (select auth.uid()) is not null and g.image_path is not null
     and (coalesce(p_days, 0) <= 0 or v.created_at >= now() - make_interval(days => p_days))
   group by g.id, p.first_name
  having sum(v.value) > 0
   order by sum(v.value) desc, g.created_at asc
   limit 10;
$$;

create or replace function public.hall_arena(p_days integer default 0)
returns table (
  id bigint, content text, image_path text, voice text,
  author_name text, wins bigint, battles bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.content, g.image_path, g.voice,
         coalesce(nullif(trim(p.first_name), ''), 'Someone'),
         count(*) filter (where d.winner_id = g.id) as wins,
         count(*) as battles
    from public.generations g
    join public.duel_votes d on g.id in (d.winner_id, d.loser_id)
    left join public.profiles p on p.id = g.user_id
   where (select auth.uid()) is not null and g.image_path is not null
     and (coalesce(p_days, 0) <= 0 or d.created_at >= now() - make_interval(days => p_days))
   group by g.id, p.first_name
  having count(*) >= 2 and count(*) filter (where d.winner_id = g.id) > 0
   order by (count(*) filter (where d.winner_id = g.id))::numeric / count(*) desc,
            count(*) desc, g.created_at asc
   limit 10;
$$;

create or replace function public.hall_creators(p_days integer default 0)
returns table (
  user_id uuid, author_name text, avatar_url text, posts bigint, score bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.user_id,
         coalesce(nullif(trim(p.first_name), ''), 'Someone'),
         p.avatar_url,
         count(distinct g.id),
         sum(v.value)::bigint
    from public.generations g
    join public.votes v on v.generation_id = g.id
    left join public.profiles p on p.id = g.user_id
   where (select auth.uid()) is not null and g.image_path is not null
     and (coalesce(p_days, 0) <= 0 or v.created_at >= now() - make_interval(days => p_days))
   group by g.user_id, p.first_name, p.avatar_url
  having sum(v.value) > 0
   order by sum(v.value) desc, count(distinct g.id) desc
   limit 10;
$$;

revoke execute on function public.hall_top_captions(integer) from public, anon;
revoke execute on function public.hall_arena(integer) from public, anon;
revoke execute on function public.hall_creators(integer) from public, anon;
grant execute on function public.hall_top_captions(integer) to authenticated;
grant execute on function public.hall_arena(integer) to authenticated;
grant execute on function public.hall_creators(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Logged-out visitors: ONLY posts the author chose to share
-- ---------------------------------------------------------------------------

create or replace function public.public_showcase(p_limit integer default 12)
returns table (
  id bigint,
  content text,
  image_path text,
  voice text,
  author_name text,
  score bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.content, g.image_path, g.voice,
         coalesce(nullif(trim(p.first_name), ''), 'Someone'),
         coalesce(sum(v.value), 0)::bigint,
         g.created_at
    from public.generations g
    left join public.votes v on v.generation_id = g.id
    left join public.profiles p on p.id = g.user_id
   where g.is_public and g.image_path is not null
   group by g.id, p.first_name
   order by coalesce(sum(v.value), 0) desc, g.created_at desc
   limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;

create or replace function public.public_post(p_id bigint)
returns table (
  id bigint,
  content text,
  image_path text,
  voice text,
  author_name text,
  score bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.content, g.image_path, g.voice,
         coalesce(nullif(trim(p.first_name), ''), 'Someone'),
         coalesce(sum(v.value), 0)::bigint,
         g.created_at
    from public.generations g
    left join public.votes v on v.generation_id = g.id
    left join public.profiles p on p.id = g.user_id
   where g.id = p_id and g.is_public and g.image_path is not null
   group by g.id, p.first_name;
$$;

-- How many captions today's Drop has so far (a number, nothing else).
create or replace function public.drop_summary(p_date date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.generations where drop_date = p_date;
$$;

revoke execute on function public.public_showcase(integer) from public;
revoke execute on function public.public_post(bigint) from public;
revoke execute on function public.drop_summary(date) from public;
grant execute on function public.public_showcase(integer) to anon, authenticated;
grant execute on function public.public_post(bigint) to anon, authenticated;
grant execute on function public.drop_summary(date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Public bucket for images the author chose to share
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shared-images', 'shared-images', true, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Authors may add, see (needed so Postgres lets them delete) and remove copies
-- in their own folder only. The public can still READ any file by its URL, but
-- cannot list the bucket.
drop policy if exists "Users can upload their own shared images" on storage.objects;
create policy "Users can upload their own shared images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shared-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can view their own shared images" on storage.objects;
create policy "Users can view their own shared images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'shared-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete their own shared images" on storage.objects;
create policy "Users can delete their own shared images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shared-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- 8. After running: set the guest-quota secret (run this yourself, once)
-- ---------------------------------------------------------------------------
-- It gates BOTH guest and member AI calls. Generate a long random string (32+ characters), put the SAME value in the
-- app's GUEST_QUOTA_SECRET environment variable, and store it here:
--
--   insert into private.app_settings (key, value)
--   values ('quota_secret', 'PASTE-A-LONG-RANDOM-STRING-HERE')
--   on conflict (key) do update set value = excluded.value;
--
-- Until this is set, guest generation refuses to run (it fails closed).
-- Limits can be tuned at any time, for example:
--   update private.app_settings set value = '5' where key = 'guest_per_visitor_daily';

notify pgrst, 'reload schema';
