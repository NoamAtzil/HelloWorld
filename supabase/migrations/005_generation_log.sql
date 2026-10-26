-- Homework 7, part 1: LLM providers/models and the generation log.
--
-- DO NOT RUN until reviewed. Run ONCE in the Supabase SQL editor, AFTER the
-- admin app's 001 (it needs public.is_superadmin()) and this repo's 004 (it needs
-- the private schema and the quota secret). Recommended order:
--   admin 001 -> 004 -> admin 002 -> THIS FILE -> admin 003.
-- It is additive and safe to re-run: no existing table, function or policy is
-- changed and nothing is deleted.
--
-- What it adds
--   llm_providers       who provides models (seeded: Google)
--   llm_models          which models exist (seeded: gemini-flash-latest)
--   generation_requests one row per real Studio AI request (no IP, no image,
--                       no secrets; only the direction text the user typed)
--   llm_responses       the caption text the model returned, with metadata
--   record_generation() the ONLY way rows get into the two log tables
--
-- Security model
--   * Every table has RLS on. Only superadmins (public.is_superadmin(), from the
--     admin app's 001) can read them; providers/models are superadmin-managed.
--   * Ordinary users and anonymous visitors have no access at all.
--   * The log tables cannot be written from the API directly. The app server
--     calls record_generation(), which requires the same server secret as the
--     quota functions, so nobody can forge or flood log rows.
--   * Models/providers that history refers to cannot be deleted (RESTRICT).

-- ---------------------------------------------------------------------------
-- 1. Providers and models
-- ---------------------------------------------------------------------------

create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  base_url text check (base_url is null or base_url ~ '^https?://[^\s]{1,200}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists llm_providers_name_key on public.llm_providers (lower(btrim(name)));

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  model_id text not null check (model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider_id, model_id)
);
-- At most one default model, and one row per model name regardless of case.
create unique index if not exists llm_models_one_default on public.llm_models (is_default) where is_default;
create unique index if not exists llm_models_provider_model_ci on public.llm_models (provider_id, lower(model_id));

-- Making a model the default quietly un-defaults the previous one.
create or replace function public.single_default_model()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.llm_models set is_default = false where is_default and id <> new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.single_default_model() from public, anon, authenticated;

drop trigger if exists single_default_model on public.llm_models;
create trigger single_default_model
  before insert or update of is_default on public.llm_models
  for each row execute function public.single_default_model();

-- Seeds that match what the app runs today (only if the tables are empty).
insert into public.llm_providers (name, base_url)
select 'Google', 'https://generativelanguage.googleapis.com'
where not exists (select 1 from public.llm_providers);

insert into public.llm_models (provider_id, model_id, display_name, is_default)
select p.id, 'gemini-flash-latest', 'Gemini Flash (latest)', true
  from public.llm_providers p
 where lower(p.name) = 'google'
   and not exists (select 1 from public.llm_models);

-- ---------------------------------------------------------------------------
-- 2. The generation log
-- ---------------------------------------------------------------------------

create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  -- NULL for guests. No FK on purpose: deleting an account must not erase or
  -- be blocked by the audit trail, and no guest identifier is stored at all.
  user_id uuid,
  kind text not null check (kind in ('takes', 'remix')),
  voice text check (voice is null or voice ~ '^[a-z][a-z-]{0,23}$'),
  direction text check (direction is null or char_length(direction) <= 200),
  source text check (source is null or source in ('library', 'upload')),
  library_slug text check (library_slug is null or library_slug ~ '^[A-Za-z0-9._-]{1,120}$'),
  model_id bigint references public.llm_models (id) on delete restrict,
  model_name text not null,
  status text not null check (status in ('ok', 'error')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete restrict,
  model_id bigint references public.llm_models (id) on delete restrict,
  response_text text check (response_text is null or char_length(response_text) <= 2000),
  finish_reason text check (finish_reason is null or char_length(finish_reason) <= 60),
  error_code text check (error_code is null or char_length(error_code) <= 60),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index if not exists llm_responses_request_idx on public.llm_responses (request_id);

-- ---------------------------------------------------------------------------
-- 3. Access: superadmin only (database-enforced)
-- ---------------------------------------------------------------------------

alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.generation_requests enable row level security;
alter table public.llm_responses enable row level security;

revoke all on public.llm_providers, public.llm_models, public.generation_requests, public.llm_responses
  from public, anon, authenticated;

grant select, insert, update, delete on public.llm_providers, public.llm_models to authenticated;
grant select on public.generation_requests, public.llm_responses to authenticated;
grant usage on sequence public.llm_providers_id_seq, public.llm_models_id_seq to authenticated;

drop policy if exists "Superadmins manage llm providers" on public.llm_providers;
create policy "Superadmins manage llm providers" on public.llm_providers
  for all to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins manage llm models" on public.llm_models;
create policy "Superadmins manage llm models" on public.llm_models
  for all to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins read generation requests" on public.generation_requests;
create policy "Superadmins read generation requests" on public.generation_requests
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "Superadmins read llm responses" on public.llm_responses;
create policy "Superadmins read llm responses" on public.llm_responses
  for select to authenticated using ((select public.is_superadmin()));

-- ---------------------------------------------------------------------------
-- 4. Writing the log: server-only, secret-gated
-- ---------------------------------------------------------------------------

-- Called by the Next.js server after a Studio AI call. user_id is taken from the
-- caller's own session (auth.uid(); NULL for guests), never from a parameter.
-- Returns the new request id, or NULL if the secret is wrong (nothing is written).
create or replace function public.record_generation(
  p_secret text,
  p_kind text,
  p_voice text,
  p_direction text,
  p_source text,
  p_slug text,
  p_model text,
  p_status text,
  p_latency_ms integer,
  p_response_text text,
  p_finish_reason text,
  p_error_code text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_model bigint;
  v_request bigint;
begin
  select s.value into v_secret from private.app_settings s where s.key = 'quota_secret';
  if v_secret is null or char_length(v_secret) < 24 or p_secret is distinct from v_secret then
    return null;
  end if;

  select m.id into v_model from public.llm_models m where m.model_id = p_model order by m.is_default desc limit 1;

  insert into public.generation_requests
    (user_id, kind, voice, direction, source, library_slug, model_id, model_name, status, latency_ms)
  values
    ((select auth.uid()), p_kind, nullif(p_voice, ''), left(p_direction, 200), nullif(p_source, ''),
     nullif(p_slug, ''), v_model, left(coalesce(p_model, 'unknown'), 100), p_status, p_latency_ms)
  returning id into v_request;

  insert into public.llm_responses (request_id, model_id, response_text, finish_reason, error_code, latency_ms)
  values (v_request, v_model, left(p_response_text, 2000), left(p_finish_reason, 60), left(p_error_code, 60), p_latency_ms);

  return v_request;
end;
$$;

revoke execute on function public.record_generation(text, text, text, text, text, text, text, text, integer, text, text, text) from public;
grant execute on function public.record_generation(text, text, text, text, text, text, text, text, integer, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
