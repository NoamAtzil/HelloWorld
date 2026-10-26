-- PREFLIGHT (read-only). Run in the Supabase SQL editor BEFORE applying
--   public 004 -> admin 002 -> public 005 -> admin 003.
-- It only SELECTs: it changes nothing and prints no secrets.
--
-- Result columns: check | status | detail
--   OK     nothing to do
--   INFO   good to know
--   WARN   read it; the migration copes, but you should understand why
--   BLOCK  STOP: a name the migrations want to create already exists with
--          unknown contents. Paste this output to me before going further.
-- The first row is the verdict. A clean run has no BLOCK rows.

with
expected_tables(schema_name, table_name) as (values
  ('public','llm_providers'),('public','llm_models'),('public','generation_requests'),('public','llm_responses'),
  ('public','daily_challenges'),('public','duel_votes'),('public','prompt_chains'),('public','prompt_chain_steps'),
  ('public','prompt_chain_mix'),('public','terms'),('public','generation_examples'),
  ('public','allowed_signup_domains'),('public','whitelisted_emails'),('public','images'),
  ('private','app_settings'),('private','ai_usage')),
expected_functions(schema_name, fn) as (values
  ('public','consume_guest_quota'),('public','consume_user_quota'),('public','drop_today'),('public','check_generation_insert'),
  ('public','check_drop_vote'),('public','arena_next_pair'),('public','arena_vote'),('public','feed_posts'),
  ('public','my_captions'),('public','drop_entries'),('public','drop_winners'),('public','hall_top_captions'),
  ('public','hall_arena'),('public','hall_creators'),('public','public_showcase'),('public','public_post'),
  ('public','drop_summary'),('public','admin_challenges'),('public','admin_set_challenge'),
  ('public','admin_delete_challenge'),('public','admin_drop_history'),('public','admin_studio_stats'),
  ('public','admin_post_studio'),('public','record_generation'),('public','single_default_model'),
  ('public','touch_updated_at'),('public','create_mix_for_step'),('public','sync_mix_chain'),
  ('public','normalize_signup_rule'),('private','setting_int'),('private','take_quota'),('private','give_back')),
expected_columns(col) as (values ('voice'),('library_slug'),('is_public'),('drop_date')),
required_tables(table_name) as (values ('books'),('profiles'),('generations'),('votes')),
required_functions(fn) as (values ('feed_generations'),('handle_new_user'),('is_superadmin'),('assert_superadmin'),
  ('protect_superadmin_flag'),('admin_overview'),('admin_users'),('admin_posts'),('admin_update_post'),
  ('admin_delete_post'),('admin_votes')),
checks as (
  -- 1. The database itself
  select 10 as ord, 'postgres version' as chk, 'INFO' as status, split_part(version(), ' on ', 1) as detail
  union all select 11, 'connected as', 'INFO', current_user || case when (select rolsuper from pg_roles where rolname = current_user) then ' (superuser)' else '' end
  union all select 12, 'can create in public / storage', case when has_schema_privilege(current_user,'public','CREATE') and has_schema_privilege(current_user,'storage','USAGE') then 'OK' else 'BLOCK' end,
         'public CREATE=' || has_schema_privilege(current_user,'public','CREATE') || ', storage USAGE=' || has_schema_privilege(current_user,'storage','USAGE')
  union all select 13, 'time zone database has America/New_York', case when exists (select 1 from pg_timezone_names where name='America/New_York') then 'OK' else 'BLOCK' end,
         'the Daily Drop clock needs it'

  -- 2. Prerequisites that must already exist (today's app + admin 001)
  union all select 20, 'existing table public.' || r.table_name, case when exists (select 1 from information_schema.tables t where t.table_schema='public' and t.table_name=r.table_name) then 'OK' else 'BLOCK' end,
         'required by the migrations'
    from required_tables r
  union all select 21, 'existing function public.' || r.fn, case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.fn) then 'OK' else 'BLOCK' end,
         'from schema.sql / 002 / admin 001'
    from required_functions r
  union all select 22, 'profiles.is_superadmin column', case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_superadmin') then 'OK' else 'BLOCK' end,
         'admin migration 001 must be applied first'
  union all select 23, 'storage bucket post-images', case when exists (select 1 from storage.buckets where id='post-images' and public=false) then 'OK' else 'BLOCK' end,
         'must exist and be private'
  union all select 24, 'at least one superadmin', case when exists (select 1 from public.profiles where is_superadmin) then 'OK' else 'WARN' end,
         (select count(*) from public.profiles where is_superadmin) || ' superadmin(s); you need one to use the admin pages'

  -- 3. Names the migrations will create must not already be taken
  union all select 30, 'table ' || e.schema_name || '.' || e.table_name || ' is free',
         case when exists (select 1 from information_schema.tables t where t.table_schema=e.schema_name and t.table_name=e.table_name) then 'BLOCK' else 'OK' end,
         case when exists (select 1 from information_schema.tables t where t.table_schema=e.schema_name and t.table_name=e.table_name)
              then 'already exists: "create table if not exists" would SKIP it and the app could mismatch its columns' else 'free' end
    from expected_tables e
  union all select 31, 'schema private is free', case when exists (select 1 from pg_namespace where nspname='private') then 'WARN' else 'OK' end,
         case when exists (select 1 from pg_namespace where nspname='private') then 'exists already; check it holds nothing of yours' else 'free' end
  union all select 32, 'function ' || e.schema_name || '.' || e.fn || ' is free',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=e.schema_name and p.proname=e.fn) then 'WARN' else 'OK' end,
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=e.schema_name and p.proname=e.fn)
              then 'exists already: "create or replace" would overwrite it (fine on a re-run, not fine if it is not ours)' else 'free' end
    from expected_functions e
  union all select 33, 'column generations.' || c.col || ' is free',
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='generations' and column_name=c.col) then 'WARN' else 'OK' end,
         case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='generations' and column_name=c.col)
              then 'exists already (add column if not exists will skip it)' else 'free' end
    from expected_columns c
  union all select 34, 'bucket ' || b || ' is free', case when exists (select 1 from storage.buckets where id=b) then 'BLOCK' else 'OK' end,
         case when exists (select 1 from storage.buckets where id=b) then 'a bucket with this name exists already' else 'free' end
    from unnest(array['shared-images','library-images']) b
  union all select 35, 'storage policy "' || p.policyname || '" is free', 'WARN', 'exists already; the migration drops and recreates policies of this exact name'
    from pg_policies p
   where p.schemaname='storage' and p.tablename='objects'
     and p.policyname in ('Users can upload their own shared images','Users can view their own shared images','Users can delete their own shared images',
                          'Superadmins can view shared images','Superadmins can delete shared images','Superadmins view library images',
                          'Superadmins upload library images','Superadmins update library images','Superadmins delete library images')

  -- 4. Data the migrations will sit beside (nothing here is modified)
  union all select 40, 'rows in ' || t, 'INFO', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text
    from unnest(array['books','profiles','generations','votes']) t
  union all select 41, 'posts without an image (old text-only rows)', 'INFO',
         (select count(*) from public.generations where image_path is null)::text
  union all select 42, 'posts whose image_path would fail the NEW path shape', 'INFO',
         (select count(*) from public.generations where image_path is not null and not (image_path ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,100}$' and image_path !~ '\.\.'))::text
         || ' (the rule is added NOT VALID: old rows are never re-checked or changed; only NEW rows must match)'
  union all select 43, 'users whose profile has no name yet', 'INFO',
         (select count(*) from public.profiles where first_name is null or last_name is null)::text
  union all select 44, 'existing RLS flags (should all be on except books may be either)', 'INFO',
         (select string_agg(relname || '=' || relrowsecurity, ', ' order by relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname in ('books','profiles','generations','votes'))
)
select * from (
  select 0 as ord, 'VERDICT' as chk,
         case when count(*) filter (where status='BLOCK') > 0 then 'BLOCK' when count(*) filter (where status='WARN') > 0 then 'WARN' else 'OK' end as status,
         count(*) filter (where status='BLOCK') || ' blocking, ' || count(*) filter (where status='WARN') || ' warning(s). '
           || case when count(*) filter (where status='BLOCK') > 0 then 'Do NOT migrate yet.' else 'Safe to proceed with the migration order.' end as detail
    from checks
  union all select ord, chk, status, detail from checks
) r
order by ord, chk;
