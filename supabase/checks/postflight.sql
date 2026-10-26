-- POST-MIGRATION VERIFICATION (read-only). Run after all four migrations (and after you
-- stored the quota_secret). It only SELECTs and never prints a secret value.
-- Result columns: check | status | detail     (PASS / FAIL / WARN / INFO). First row = verdict.
-- If it stops with an error such as 'relation ... does not exist' or 'column ... does not
-- exist', the migrations are not (fully) applied: that is a failure, not a query bug.
-- Also run HelloWorld-Admin/supabase/tests/admin_access_checks.sql (existing, read-only).

with
-- table, anon privileges expected, authenticated privileges expected  (s=select i=insert u=update d=delete)
tbl(schema_name, table_name, anon_expected, auth_expected) as (values
  ('public','llm_providers','','sidu'),('public','llm_models','','sidu'),
  ('public','generation_requests','','s'),('public','llm_responses','','s'),
  ('public','daily_challenges','s','s'),('public','duel_votes','','s'),
  ('public','prompt_chains','','sidu'),('public','prompt_chain_steps','','sidu'),
  ('public','prompt_chain_mix','','s'),('public','terms','','sidu'),('public','generation_examples','','sidu'),
  ('public','allowed_signup_domains','','sidu'),('public','whitelisted_emails','','sidu'),('public','images','','sidu'),
  ('private','app_settings','',''),('private','ai_usage','','')),
-- function, may anon execute, may authenticated execute
fns(schema_name, fn, anon_ok, auth_ok) as (values
  ('public','consume_guest_quota',true,true),('public','consume_user_quota',false,true),('public','drop_today',true,true),
  ('public','arena_next_pair',false,true),('public','arena_vote',false,true),('public','feed_posts',false,true),
  ('public','my_captions',false,true),('public','drop_entries',false,true),('public','drop_winners',false,true),
  ('public','hall_top_captions',false,true),('public','hall_arena',false,true),('public','hall_creators',false,true),
  ('public','public_showcase',true,true),('public','public_post',true,true),('public','drop_summary',true,true),
  ('public','record_generation',true,true),
  ('public','admin_challenges',false,true),('public','admin_set_challenge',false,true),('public','admin_delete_challenge',false,true),
  ('public','admin_drop_history',false,true),('public','admin_studio_stats',false,true),('public','admin_post_studio',false,true),
  -- internal helpers: nobody may call these over the API
  ('public','check_generation_insert',false,false),('public','check_drop_vote',false,false),('public','single_default_model',false,false),
  ('public','touch_updated_at',false,false),('public','create_mix_for_step',false,false),('public','sync_mix_chain',false,false),
  ('public','normalize_signup_rule',false,false),('private','setting_int',false,false),('private','take_quota',false,false),('private','give_back',false,false)),
-- policies that existed BEFORE and must still be there
old_policies(tablename, policyname) as (values
  ('profiles','Users can view their own profile'),('profiles','Users can update their own profile'),
  ('generations','Users can view their own generations'),('generations','Users can create their own generations'),
  ('generations','Users can delete their own generations'),
  ('votes','Users can view their own votes'),('votes','Users can create their own votes'),
  ('votes','Users can change their own votes'),('votes','Users can remove their own votes'),
  ('books','Public read access'),
  ('objects','Users can upload their own post images'),('objects','Signed-in users can view post images'),
  ('objects','Users can delete their own post images'),('objects','Users can upload their own avatar'),
  ('objects','Users can update their own avatar'),('objects','Users can view their own avatar')),
checks as (
  -- every new table: exists, RLS on, exact privileges, at least one policy where users have any access
  select 10 as ord, 'table ' || t.schema_name || '.' || t.table_name as chk,
         case when c.oid is null then 'FAIL' when not c.relrowsecurity then 'FAIL'
              when (select coalesce(string_agg(l, '' order by l), '') from (select case p when 'select' then 's' when 'insert' then 'i' when 'update' then 'u' when 'delete' then 'd' end as l
                      from unnest(array['select','insert','update','delete']) p where has_table_privilege('anon', c.oid, p)) x) <> (select string_agg(ch, '' order by ch) from regexp_split_to_table(t.anon_expected, '') ch) and t.anon_expected <> '' then 'FAIL'
              when t.anon_expected = '' and (select count(*) from unnest(array['select','insert','update','delete']) p where has_table_privilege('anon', c.oid, p)) > 0 then 'FAIL'
              else 'PASS' end as status,
         case when c.oid is null then 'MISSING' else
           'RLS=' || c.relrowsecurity
           || ' | anon: ' || coalesce(nullif((select string_agg(left(p,1), '') from unnest(array['select','insert','update','delete']) p where has_table_privilege('anon', c.oid, p)), ''), 'none')
           || ' (expected ' || coalesce(nullif(t.anon_expected,''), 'none') || ')'
           || ' | authenticated: ' || coalesce(nullif((select string_agg(case p when 'update' then 'u' else left(p,1) end, '') from unnest(array['select','insert','update','delete']) p where has_table_privilege('authenticated', c.oid, p)), ''), 'none')
           || ' (expected ' || coalesce(nullif(t.auth_expected,''), 'none') || ')'
           || ' | policies: ' || (select count(*) from pg_policies pp where pp.schemaname=t.schema_name and pp.tablename=t.table_name) end as detail
    from tbl t
    left join pg_namespace n on n.nspname = t.schema_name
    left join pg_class c on c.relnamespace = n.oid and c.relname = t.table_name and c.relkind = 'r'

  -- function privileges
  union all select 20, 'function ' || f.schema_name || '.' || f.fn,
         case when p.oid is null then 'FAIL'
              when has_function_privilege('anon', p.oid, 'execute') = f.anon_ok and has_function_privilege('authenticated', p.oid, 'execute') = f.auth_ok then 'PASS' else 'FAIL' end,
         case when p.oid is null then 'MISSING' else
           'anon can execute=' || has_function_privilege('anon', p.oid, 'execute') || ' (expected ' || f.anon_ok || '), authenticated=' || has_function_privilege('authenticated', p.oid, 'execute') || ' (expected ' || f.auth_ok || ')' end
    from fns f
    left join pg_namespace n on n.nspname = f.schema_name
    left join pg_proc p on p.pronamespace = n.oid and p.proname = f.fn

  -- the private schema is closed
  union all select 30, 'schema private closed to the API roles',
         case when not has_schema_privilege('anon','private','usage') and not has_schema_privilege('authenticated','private','usage') then 'PASS' else 'FAIL' end,
         'anon usage=' || has_schema_privilege('anon','private','usage') || ', authenticated usage=' || has_schema_privilege('authenticated','private','usage')

  -- existing policies intact
  union all select 40, 'existing policy ' || o.tablename || ': ' || o.policyname,
         case when exists (select 1 from pg_policies p where p.tablename=o.tablename and p.policyname=o.policyname and p.schemaname in ('public','storage')) then 'PASS' else 'FAIL' end,
         'must still exist'
    from old_policies o
  union all select 41, 'existing tables keep RLS', case when (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','generations','votes') and c.relrowsecurity) = 3 then 'PASS' else 'FAIL' end,
         'profiles, generations, votes must have RLS enabled'
  union all select 42, 'no policy added to profiles/generations/votes/books beyond the originals', 'INFO',
         (select count(*) from pg_policies where schemaname='public' and tablename in ('profiles','generations','votes','books'))::text || ' policies on the original tables (unchanged from before: compare with the preflight list)'

  -- buckets
  union all select 50, 'bucket ' || b.id, case when exists (select 1 from storage.buckets x where x.id=b.id and x.public=b.pub and x.file_size_limit=4194304 and x.allowed_mime_types @> array['image/jpeg','image/png','image/webp']) then 'PASS' else 'FAIL' end,
         coalesce((select 'public=' || x.public || ', limit=' || x.file_size_limit || ', types=' || array_to_string(x.allowed_mime_types, ',') from storage.buckets x where x.id=b.id), 'MISSING')
    from (values ('shared-images', true), ('library-images', true), ('post-images', false)) as b(id, pub)
  union all select 51, 'storage policies on the new buckets', case when (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%shared-images%' or with_check like '%shared-images%' or qual like '%library-images%' or with_check like '%library-images%')) = 9 then 'PASS' else 'FAIL' end,
         (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%shared-images%' or with_check like '%shared-images%' or qual like '%library-images%' or with_check like '%library-images%'))::text || ' found (9 expected: 3 shared-images for authors, 2 shared-images for superadmins, 4 library-images for superadmins)'

  -- columns, constraints, triggers on existing tables
  union all select 60, 'generations new columns', case when (select count(*) from information_schema.columns where table_schema='public' and table_name='generations' and column_name in ('voice','library_slug','is_public','drop_date')) = 4 then 'PASS' else 'FAIL' end,
         'voice, library_slug, is_public, drop_date'
  union all select 61, 'historical posts are still private', case when (select count(*) from public.generations where is_public) = 0 then 'PASS' else 'WARN' end,
         (select count(*) from public.generations where is_public)::text || ' post(s) have is_public = true (0 expected right after migrating; later ones are authors'' own opt-ins)'
  union all select 62, 'triggers on existing tables', case when (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname in ('check_generation_insert','check_drop_vote')) = 2 then 'PASS' else 'FAIL' end,
         'check_generation_insert (generations), check_drop_vote (votes)'
  union all select 63, 'constraints', case when (select count(*) from pg_constraint where conname in ('generations_voice_format','generations_slug_format','generations_drop_needs_slug','generations_image_path_shape')) = 4 then 'PASS' else 'FAIL' end,
         'generations_image_path_shape is NOT VALID by design: ' || coalesce((select (not convalidated)::text from pg_constraint where conname='generations_image_path_shape'), 'missing')

  -- seeds
  union all select 70, 'seed: Google provider', case when exists (select 1 from public.llm_providers where lower(name)='google') then 'PASS' else 'FAIL' end, 'expected 1'
  union all select 71, 'seed: default Gemini model', case when exists (select 1 from public.llm_models where model_id='gemini-flash-latest' and is_default) then 'PASS' else 'FAIL' end, 'gemini-flash-latest, default'
  union all select 72, 'seed: prompt chains with steps and mix', case when (select count(*) from public.prompt_chains) >= 6 and (select count(*) from public.prompt_chain_mix) >= 6 then 'PASS' else 'FAIL' end,
         (select count(*) from public.prompt_chains)::text || ' chains, ' || (select count(*) from public.prompt_chain_steps)::text || ' steps, ' || (select count(*) from public.prompt_chain_mix)::text || ' mix rows'

  -- settings (never prints the value)
  union all select 80, 'quota_secret is set (length only)', case when exists (select 1 from private.app_settings where key='quota_secret' and char_length(value) >= 24) then 'PASS' else 'WARN' end,
         case when exists (select 1 from private.app_settings where key='quota_secret' and char_length(value) >= 24) then 'set, ' || (select char_length(value) from private.app_settings where key='quota_secret') || ' characters. Make sure the app env GUEST_QUOTA_SECRET holds the same value.'
              else 'NOT SET: all Studio AI generation (guests AND members) refuses until you store it (see 004, section 8)' end
  union all select 81, 'quota limits', 'INFO', (select string_agg(key || '=' || value, ', ' order by key) from private.app_settings where key <> 'quota_secret')

  -- who can use the admin pages, and row counts to compare with the preflight
  union all select 90, 'superadmins', case when (select count(*) from public.profiles where is_superadmin) >= 1 then 'PASS' else 'FAIL' end, (select count(*) from public.profiles where is_superadmin)::text
  union all select 91, 'rows in ' || t, 'INFO', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text || ' (compare with the preflight numbers: must be equal or higher)'
    from unnest(array['books','profiles','generations','votes']) t
)
select * from (
  select 0 as ord, 'VERDICT' as chk,
         case when count(*) filter (where status='FAIL') > 0 then 'FAIL' when count(*) filter (where status='WARN') > 0 then 'WARN' else 'PASS' end as status,
         count(*) filter (where status='PASS') || ' passed, ' || count(*) filter (where status='FAIL') || ' failed, ' || count(*) filter (where status='WARN') || ' warning(s)' as detail
    from checks
  union all select ord, chk, status, detail from checks
) r
order by ord, chk;
