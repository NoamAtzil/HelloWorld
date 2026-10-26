// Proves the four pending migrations (004, admin 002, 005, admin 003) change nothing that
// already exists: same policies, same grants, same function bodies, same data.
// Order of the last four files in `files` is the required migration order.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, files } from "./harness.mjs";

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
// base = schema.sql, 002, 003, admin 001 (what production has today)
const base = files.slice(0, 4);
const pending = [files[4], files[5], files[6], files[7]];
assert.match(pending[0], /004_/); assert.match(pending[1], /002_admin_studio/);
assert.match(pending[2], /005_/); assert.match(pending[3], /003_admin_ai_config/);

const db = await boot(base);

const id = (c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12);
const [A, B] = [id("a"), id("b")];
for (const [u, name] of [[A, "Ann"], [B, "Bob"]]) {
  await db.query("insert into auth.users (id,email) values ($1,$2)", [u, name + "@x.com"]);
  await db.query("update public.profiles set first_name=$2, last_name='Z' where id=$1", [u, name]);
}
await db.query("update public.profiles set is_superadmin=true where id=$1", [A]);
// historical data, including odd-looking image paths from the past
await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','old one',$2,'m'),($3,'p','old two',$4,'m')", [A, `${A}/ok.jpg`, B, `${B}/weird name (1).jpg`]);
await db.query("insert into public.votes (user_id,generation_id,value) values ($1,2,1),($2,1,-1),($1,1,1)", [A, B]);

const snapshot = async () => {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    policies: await q(`select schemaname, tablename, policyname, cmd, roles::text, qual, with_check from pg_policies
                        where schemaname in ('public','storage') order by 1,2,3`),
    grants: await q(`select table_name, grantee, privilege_type from information_schema.table_privileges
                      where table_schema='public' and table_name in ('books','profiles','generations','votes') order by 1,2,3`),
    colgrants: await q(`select table_name, column_name, grantee, privilege_type from information_schema.column_privileges
                         where table_schema='public' and table_name in ('profiles','generations','votes') and grantee in ('anon','authenticated') order by 1,2,3,4`),
    rls: await q(`select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and relname in ('books','profiles','generations','votes') order by 1`),
    functions: await q(`select p.proname, md5(pg_get_functiondef(p.oid)) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname in ('feed_generations','handle_new_user','is_superadmin','assert_superadmin',
                           'protect_superadmin_flag','admin_overview','admin_users','admin_posts','admin_update_post','admin_delete_post','admin_votes') order by 1`),
    triggers: await q(`select t.tgname, c.relname as tbl from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
                        where not t.tgisinternal and ((n.nspname='public' and c.relname in ('profiles','generations','votes','books')) or (n.nspname='auth' and c.relname='users')) order by 1`),
    data: await q(`select 'books' t, count(*)::int c, coalesce(md5(string_agg(b::text, ',' order by id)),'') h from public.books b
                   union all select 'profiles', count(*)::int, md5(string_agg(row(id,first_name,last_name,avatar_url,is_superadmin)::text, ',' order by id)) from public.profiles
                   union all select 'generations', count(*)::int, md5(string_agg(row(id,user_id,prompt,content,image_path,model,created_at)::text, ',' order by id)) from public.generations
                   union all select 'votes', count(*)::int, md5(string_agg(row(id,user_id,generation_id,value,created_at)::text, ',' order by id)) from public.votes
                   union all select 'users', count(*)::int, md5(string_agg(id::text, ',' order by id)) from auth.users
                   order by 1`),
    buckets: await q(`select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('avatars','post-images') order by 1`),
  };
};

const before = await snapshot();
assert.ok(before.policies.length > 5 && before.data.find((d) => d.t === "generations").c === 2);

for (const f of pending) {
  try { await db.exec(readFileSync(f, "utf8")); }
  catch (e) { console.error("FAILED applying", f, "\n", e.message); process.exit(1); }
}
ok("the four migrations apply in the required order on top of today's schema, with data present");
for (const f of pending) await db.exec(readFileSync(f, "utf8"));
ok("applying all four a second time also succeeds (re-run safe)");

const after = await snapshot();
const keyOf = (r) => JSON.stringify(r);
for (const k of ["policies", "grants", "colgrants", "rls", "functions", "triggers", "buckets"]) {
  const afterSet = new Set(after[k].map(keyOf));
  for (const row of before[k]) assert.ok(afterSet.has(keyOf(row)), `${k}: existing entry changed or removed: ${keyOf(row)}`);
}
ok("every existing policy, grant, RLS flag, function body, bucket and trigger is still present and unchanged");
assert.deepEqual(after.data, before.data);
ok("every existing row in books, profiles, generations, votes and auth.users is byte-for-byte unchanged");

// What the migrations DID add to existing tables (reported, not hidden).
const EXISTING = ["books", "profiles", "generations", "votes"];
const beforeKeys = new Set(before.policies.map(keyOf));
const added = after.policies.filter((r) => !beforeKeys.has(keyOf(r)));
const onExisting = added.filter((r) => EXISTING.includes(r.tablename));
const onStorage = added.filter((r) => r.schemaname === "storage").map((r) => r.policyname);
const addedTriggers = after.triggers.filter((r) => !before.triggers.some((b) => b.tgname === r.tgname && b.tbl === r.tbl));
const addedGrants = after.grants.filter((r) => !new Set(before.grants.map(keyOf)).has(keyOf(r)));
console.log("\n  what the migrations ADD to existing objects:");
console.log("   policies on books/profiles/generations/votes:", onExisting.length);
console.log("   new storage.objects policies (new buckets only):", onStorage.join("; "));
console.log("   triggers on existing tables:", addedTriggers.map((t) => `${t.tbl}.${t.tgname}`).join(", "));
console.log("   new table-level grants on existing tables:", addedGrants.length);
assert.equal(onExisting.length, 0);
assert.equal(addedGrants.length, 0);
assert.deepEqual(addedTriggers.map((t) => `${t.tbl}.${t.tgname}`).sort(), ["generations.check_generation_insert", "votes.check_drop_vote"]);
assert.ok(onStorage.every((p) => /shared images|library images/.test(p)), "storage policies are only for the two new buckets");
ok("no policy or table-level grant was added to books/profiles/generations/votes; the only new storage policies are for the two new buckets; the only new triggers on existing tables are the two documented ones");

// Historical rows with odd image paths survive and stay private.
const old = (await db.query("select image_path, is_public, voice, library_slug, drop_date from public.generations order by id")).rows;
assert.equal(old[1].image_path, `${B}/weird name (1).jpg`);
assert.ok(old.every((r) => r.is_public === false && r.voice === null && r.library_slug === null && r.drop_date === null));
ok("historical posts (including unusual image paths) are intact, private, and unclassified");

// Existing admin function still works for the superadmin.
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${A}',false);`);
const ov = (await db.query("select public.admin_overview() o")).rows[0].o;
assert.equal(ov.posts, 2); assert.equal(ov.votes, 3);
await db.exec("reset role;");
ok("existing admin_overview() still returns the right numbers for a superadmin");

// The apps deployed TODAY (old code) must keep working against the migrated database.
import { as } from "./harness.mjs";
await as(db, B, async () => {
  // old caption flow: insert with only the old columns, vote, read the feed, delete own post
  const g = (await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','new old-style',$2,'gemini-flash-latest') returning id", [B, `${B}/${id("c")}.jpg`])).rows[0].id;
  await db.query("insert into public.votes (user_id,generation_id,value) values ($1,$2,1)", [B, g]); // self-vote on a normal post: allowed, as before
  await db.query("update public.votes set value=-1 where user_id=$1 and generation_id=$2", [B, g]);   // flip, as the feed does
  const feed = (await db.query("select * from public.feed_generations()")).rows;
  assert.ok(feed.some((r) => r.id === g && Number(r.score) === -1));
  await db.query("delete from public.votes where user_id=$1 and generation_id=$2", [B, g]);
  assert.equal((await db.query("delete from public.generations where id=$1 returning id", [g])).rows.length, 1);
  await db.query("update public.profiles set first_name='Bobby', last_name='Z' where id=$1", [B]);
});
await as(db, A, async () => {
  // old admin app: every existing admin function, plus create / edit / delete a post
  assert.equal((await db.query("select * from public.admin_users('', 'newest', 10, 0)")).rows.length, 2);
  const ap = (await db.query("select * from public.admin_posts('', 'newest', 10, 0)")).rows;
  assert.equal(ap.length, 2);
  assert.ok((await db.query("select * from public.admin_votes(10, 0)")).rows.length >= 1);
  const created = (await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'Added by an administrator','admin post',$2,'admin') returning id", [A, `${A}/${id("d")}.png`])).rows[0].id;
  await db.query("select public.admin_update_post($1,'edited','edited prompt')", [created]);
  const path = (await db.query("select public.admin_delete_post($1) p", [created])).rows[0].p;
  assert.equal(path, `${A}/${id("d")}.png`);
});
ok("today's deployed flows still work: post, vote, flip, feed, delete, profile update; admin users/posts/votes/create/edit/delete");

// Nothing leaked: no secret is stored by the migrations.
const secrets = (await db.query("select key, value from private.app_settings where key like '%secret%'")).rows;
assert.equal(secrets.length, 0);
ok("no secret value exists after migrating (quota_secret is something you set yourself)");
console.log(`\nALL ${n} PRESERVATION CHECKS PASSED`);
