// SQL integration tests for the Studio/Arena/Drop migration, run on PGlite
// (WASM Postgres) with minimal stand-ins for Supabase's auth/storage schemas.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// Applies the repo's real SQL, in order, to a throw-away in-memory Postgres
// (PGlite) with minimal stand-ins for Supabase's auth/storage schemas. It never
// touches your Supabase project.
//
//   cd HelloWorld && npm i --no-save @electric-sql/pglite
//   node supabase/tests/sql/studio_arena_drop.test.mjs
//   node supabase/tests/sql/admin_studio.test.mjs      (needs ../HelloWorld-Admin next to this repo)
const here = new URL("../../../", import.meta.url).pathname; // HelloWorld/
const admin = new URL("../../../../HelloWorld-Admin/", import.meta.url).pathname;
export const files = [
  `${here}supabase/schema.sql`,
  `${here}supabase/migrations/002_photo_captions.sql`,
  `${here}supabase/migrations/003_delete_own_posts.sql`,
  `${admin}supabase/migrations/001_admin_access.sql`,
  `${here}supabase/migrations/004_studio_arena_drop.sql`,
  ...(/admin_studio|homework7|preserve|checks/.test(process.argv[1] ?? "") ? [`${admin}supabase/migrations/002_admin_studio.sql`] : []),
  ...(/homework7|preserve|checks/.test(process.argv[1] ?? "")
    ? [`${here}supabase/migrations/005_generation_log.sql`, `${admin}supabase/migrations/003_admin_ai_config.sql`]
    : []),
];

export async function boot(list = files) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner_id text);
    create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const f of list) {
    try { await db.exec(readFileSync(f, "utf8")); }
    catch (e) { console.error("FAILED applying", f, "\n", e.message); process.exit(1); }
  }
  return db;
}

export async function as(db, uid, fn) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
export async function fails(promise, re) {
  try { await promise; } catch (e) { assert.match(String(e.message), re, `wrong error: ${e.message}`); return; }
  assert.fail(`expected failure matching ${re}`);
}
