// Homework 7: superadmin-only CRUD, ordinary/anonymous denial, logging permissions,
// image-bucket permissions, history protection.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, as, fails, files } from "./harness.mjs";
let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const db = await boot();
for (const f of files.slice(-2)) await db.exec(readFileSync(f, "utf8"));
ok("005 and admin 003 apply on top of the full chain, and are safe to re-run");

const id = (c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12);
const [ADM, REG, MEM] = [id("1"), id("2"), id("3")];
for (const [u, name] of [[ADM, "Root"], [REG, "Reg"], [MEM, "Mem"]]) {
  await db.query("insert into auth.users (id,email) values ($1,$2)", [u, name + "@x.com"]);
  await db.query("update public.profiles set first_name=$2 where id=$1", [u, name]);
}
await db.query("update public.profiles set is_superadmin=true where id=$1", [ADM]);

// ---- seeds ---------------------------------------------------------------
assert.equal((await db.query("select count(*)::int c from public.llm_providers")).rows[0].c, 1);
const model = (await db.query("select * from public.llm_models")).rows[0];
assert.equal(model.model_id, "gemini-flash-latest"); assert.equal(model.is_default, true);
assert.equal((await db.query("select count(*)::int c from public.prompt_chains")).rows[0].c, 6);
assert.equal((await db.query("select count(*)::int c from public.prompt_chain_mix")).rows[0].c, 6);
ok("seeds: Google + Gemini model (default), 6 documentation chains, each with a step and a mix row");

const TABLES = ["llm_providers", "llm_models", "generation_requests", "llm_responses", "prompt_chains", "prompt_chain_steps",
  "prompt_chain_mix", "terms", "generation_examples", "allowed_signup_domains", "whitelisted_emails", "images"];

// ---- anonymous / ordinary denial -----------------------------------------
await as(db, null, async () => {
  for (const t of TABLES) await fails(db.query(`select * from public.${t}`), /permission denied/);
  for (const t of ["terms", "images", "llm_models"]) await fails(db.query(`delete from public.${t}`), /permission denied/);
});
ok("anonymous visitors cannot read any new table");
await as(db, REG, async () => {
  for (const t of TABLES) assert.equal((await db.query(`select * from public.${t}`)).rows.length, 0, `${t} must look empty to a regular user`);
  await fails(db.query("insert into public.terms (term) values ('x')"), /row-level security/);
  await fails(db.query("insert into public.allowed_signup_domains (domain) values ('evil.com')"), /row-level security/);
  await fails(db.query("insert into public.whitelisted_emails (email) values ('a@evil.com')"), /row-level security/);
  await fails(db.query("insert into public.llm_models (provider_id,model_id,display_name) values (1,'m','M')"), /row-level security/);
  await fails(db.query("insert into public.images (storage_path,title) values ('11111111-1111-1111-1111-111111111111.jpg','t')"), /row-level security/);
  assert.equal((await db.query("update public.terms set term='hacked' returning id")).rows.length, 0);
  assert.equal((await db.query("delete from public.prompt_chains returning id")).rows.length, 0);
  assert.equal((await db.query("update public.prompt_chain_mix set weight=0 returning id")).rows.length, 0);
});
assert.equal((await db.query("select count(*)::int c from public.prompt_chains")).rows[0].c, 6);
ok("ordinary users see nothing and cannot insert, update or delete in any new table");

// ---- superadmin CRUD -----------------------------------------------------
await as(db, ADM, async () => {
  // terms
  const t = (await db.query("insert into public.terms (term, definition, category) values ('  Roast ', 'friendly burns', 'style') returning id")).rows[0].id;
  await fails(db.query("insert into public.terms (term) values ('roast')"), /duplicate|unique/);
  await db.query("update public.terms set definition='x' where id=$1", [t]);
  assert.equal((await db.query("select count(*)::int c from public.terms")).rows[0].c, 1);
  await db.query("delete from public.terms where id=$1", [t]);
  // examples
  const e = (await db.query("insert into public.generation_examples (title,caption,voice) values ('t','c','noir') returning id")).rows[0].id;
  await fails(db.query("insert into public.generation_examples (title,caption,voice) values ('t','c','NOIR!')"), /voice/);
  await db.query("update public.generation_examples set caption='c2' where id=$1", [e]);
  await db.query("delete from public.generation_examples where id=$1", [e]);
  // providers/models CRUD
  const p = (await db.query("insert into public.llm_providers (name) values ('Acme') returning id")).rows[0].id;
  await fails(db.query("insert into public.llm_providers (name) values (' acme ')"), /duplicate|unique/);
  const m = (await db.query("insert into public.llm_models (provider_id,model_id,display_name) values ($1,'acme-1','Acme 1') returning id", [p])).rows[0].id;
  await db.query("insert into public.llm_models (provider_id,model_id,display_name,is_default) values ($1,'acme-2','Acme 2',true)", [p]);
  assert.equal((await db.query("select count(*)::int c from public.llm_models where is_default")).rows[0].c, 1, "only one default");
  await db.query("delete from public.llm_models where model_id='acme-2'");
  await fails(db.query("insert into public.llm_models (provider_id,model_id,display_name) values ($1,'bad model!','x')", [p]), /model_id/);
  await db.query("update public.llm_models set display_name='Acme One' where id=$1", [m]);
  await fails(db.query("delete from public.llm_providers where id=$1", [p]), /foreign key/);
  await db.query("delete from public.llm_models where id=$1", [m]);
  await db.query("delete from public.llm_providers where id=$1", [p]);
  // chains / steps / mix
  const c = (await db.query("insert into public.prompt_chains (name,voice_id) values ('Custom','classic') returning id")).rows[0].id;
  const s1 = (await db.query("insert into public.prompt_chain_steps (chain_id,position,instruction) values ($1,1,'do a') returning id", [c])).rows[0].id;
  await fails(db.query("insert into public.prompt_chain_steps (chain_id,position,instruction) values ($1,1,'dup')", [c]), /duplicate|unique/);
  const mix = (await db.query("select * from public.prompt_chain_mix where step_id=$1", [s1])).rows;
  assert.equal(mix.length, 1); assert.equal(mix[0].weight, 100);
  await db.query("update public.prompt_chain_mix set weight=40 where step_id=$1", [s1]);
  await fails(db.query("update public.prompt_chain_mix set weight=101 where step_id=$1", [s1]), /weight/);
  await fails(db.query("insert into public.prompt_chain_mix (chain_id,step_id,weight) values ($1,$2,5)", [c, s1]), /permission denied/);
  await fails(db.query("delete from public.prompt_chain_mix where step_id=$1", [s1]), /permission denied/);
  await fails(db.query("update public.prompt_chain_mix set step_id=1 where step_id=$1", [s1]), /permission denied/);
  await db.query("delete from public.prompt_chain_steps where id=$1", [s1]);
  assert.equal((await db.query("select * from public.prompt_chain_mix where step_id=$1", [s1])).rows.length, 0, "mix goes with its step");
  await db.query("delete from public.prompt_chains where id=$1", [c]);
});
ok("superadmin: full CRUD on terms, examples, providers, models, chains, steps; mix is read/update(weight) only; validation and uniqueness hold");

await as(db, ADM, async () => {
  const d = (await db.query("insert into public.allowed_signup_domains (domain,note) values ('  Columbia.EDU ','school') returning domain")).rows[0].domain;
  assert.equal(d, "columbia.edu");
  await fails(db.query("insert into public.allowed_signup_domains (domain) values ('COLUMBIA.edu')"), /duplicate|unique/);
  for (const bad of ["nodot", "a b.com", "-x.com", "x..com", "http://x.com", "x.com/path"]) {
    await fails(db.query("insert into public.allowed_signup_domains (domain) values ($1)", [bad]), /domain|violates/);
  }
  const e = (await db.query("insert into public.whitelisted_emails (email) values (' Noam@Gmail.com ') returning email")).rows[0].email;
  assert.equal(e, "noam@gmail.com");
  await fails(db.query("insert into public.whitelisted_emails (email) values ('NOAM@gmail.com')"), /duplicate|unique/);
  for (const bad of ["no-at.com", "a@b", "a b@c.com", "@c.com", "a@@c.com"]) {
    await fails(db.query("insert into public.whitelisted_emails (email) values ($1)", [bad]), /email|violates/);
  }
  await db.query("update public.whitelisted_emails set note='me' where email=$1", [e]);
  await db.query("delete from public.whitelisted_emails where email=$1", [e]);
  await db.query("delete from public.allowed_signup_domains where domain=$1", [d]);
});
ok("signup domains/emails: CRUD for superadmin, normalized to lower case, validated, unique; nothing enforces them");

// ---- images and storage --------------------------------------------------
const path = "aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb.jpg";
await as(db, ADM, async () => {
  await fails(db.query("insert into public.images (storage_path,title) values ('../x.jpg','t')"), /storage_path/);
  await fails(db.query("insert into public.images (storage_path,title) values ('folder/aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb.jpg','t')"), /storage_path/);
  await fails(db.query("insert into public.images (storage_path,title) values ('aaaaaaaa-1111-4111-8111-bbbbbbbbbbbb.exe','t')"), /storage_path/);
  const r = (await db.query("insert into public.images (storage_path,title) values ($1,'Cat') returning created_by", [path])).rows[0];
  assert.equal(r.created_by, ADM);
  await db.query("insert into storage.objects (bucket_id,name) values ('library-images',$1)", [path]);
  assert.equal((await db.query("select * from storage.objects where bucket_id='library-images'")).rows.length, 1);
  await db.query("update storage.objects set name=name where bucket_id='library-images'");
});
await as(db, REG, async () => {
  await fails(db.query("insert into storage.objects (bucket_id,name) values ('library-images',$1)", ["bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb.jpg"]), /row-level security/);
  assert.equal((await db.query("select * from storage.objects where bucket_id='library-images'")).rows.length, 0, "not even listable");
  assert.equal((await db.query("delete from storage.objects where bucket_id='library-images' returning id")).rows.length, 0);
});
await as(db, ADM, async () => {
  assert.equal((await db.query("delete from storage.objects where bucket_id='library-images' returning id")).rows.length, 1);
  await db.query("delete from public.images where storage_path=$1", [path]);
});
ok("images: path shape enforced; only superadmins can upload, list, replace or delete library files");
assert.deepEqual((await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id='library-images'")).rows[0],
  { public: true, file_size_limit: 4194304, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] });
ok("library-images bucket: public read, 4 MB cap, jpeg/png/webp only");

// ---- generation logging --------------------------------------------------
const SECRET = "log-secret-".repeat(3);
await db.query("insert into private.app_settings values ('quota_secret',$1)", [SECRET]);
const rec = (secret, over = {}) => db.query(
  "select public.record_generation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) r",
  [secret, "takes", "noir", "roast us", "library", "pic.jpg", "gemini-flash-latest", "ok", 812, '["a","b","c"]', "STOP", null].map((v, i) => over[i] ?? v));
await as(db, null, async () => {
  assert.equal((await rec("wrong-wrong-wrong-wrong-wrong-xx")).rows[0].r, null);
  assert.equal((await rec(SECRET)).rows[0].r !== null, true, "guest request logged");
  await fails(db.query("insert into public.generation_requests (kind,model_name,status) values ('takes','m','ok')"), /permission denied/);
});
await as(db, MEM, async () => {
  assert.equal((await rec(SECRET, { 3: "x".repeat(500) })).rows[0].r !== null, true);
  assert.equal((await db.query("select * from public.generation_requests")).rows.length, 0, "members cannot read the log");
  await fails(db.query("insert into public.llm_responses (request_id,response_text) values (1,'forged')"), /row-level security|permission denied/);
  assert.equal((await rec("short")).rows[0].r, null);
});
ok("logging: only the server (secret) can write; guests and members cannot forge or read rows");
const rows = (await db.query("select * from public.generation_requests order by id")).rows;
assert.equal(rows.length, 2); assert.equal(rows[0].user_id, null); assert.equal(rows[1].user_id, MEM);
assert.equal(rows[1].direction.length, 200); assert.equal(rows[0].model_id, model.id);
assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at","direction","id","kind","latency_ms","library_slug","model_id","model_name","source","status","user_id","voice"]);
ok("logged rows hold only minimal metadata (no IP, no image, no secret); direction is capped at 200; user id comes from the session");
await as(db, ADM, async () => {
  assert.equal((await db.query("select * from public.generation_requests")).rows.length, 2);
  const resp = (await db.query("select * from public.llm_responses order by id")).rows;
  assert.equal(resp.length, 2); assert.equal(resp[0].response_text, '["a","b","c"]');
  await fails(db.query("delete from public.generation_requests"), /permission denied/);
  await fails(db.query("update public.llm_responses set response_text='x'"), /permission denied/);
  await fails(db.query("delete from public.llm_models where id=$1", [model.id]), /foreign key/);
});
ok("superadmin can read requests and responses but not edit or delete them; the model used in history cannot be deleted");


// ---- regressions from review -------------------------------------------
await as(db, ADM, async () => {
  const c1 = (await db.query("insert into public.prompt_chains (name) values ('C1') returning id")).rows[0].id;
  const c2 = (await db.query("insert into public.prompt_chains (name) values ('C2') returning id")).rows[0].id;
  const st = (await db.query("insert into public.prompt_chain_steps (chain_id,position,instruction) values ($1,1,'x') returning id", [c1])).rows[0].id;
  await db.query("update public.prompt_chain_steps set chain_id=$1 where id=$2", [c2, st]);
  assert.equal((await db.query("select chain_id from public.prompt_chain_mix where step_id=$1", [st])).rows[0].chain_id, c2, "mix follows its step");
  await db.query("delete from public.prompt_chains where id=$1", [c1]);
  assert.equal((await db.query("select count(*)::int c from public.prompt_chain_mix where step_id=$1", [st])).rows[0].c, 1, "deleting the old chain keeps the moved step's mix");
  await db.query("delete from public.prompt_chains where id=$1", [c2]);
  // switching the default model
  const prov = (await db.query("select id from public.llm_providers limit 1")).rows[0].id;
  await db.query("insert into public.llm_models (provider_id,model_id,display_name,is_default) values ($1,'other-model','Other',true)", [prov]);
  const defaults = (await db.query("select model_id from public.llm_models where is_default")).rows;
  assert.deepEqual(defaults.map((r) => r.model_id), ["other-model"]);
  await fails(db.query("insert into public.llm_models (provider_id,model_id,display_name) values ($1,'OTHER-MODEL','dup')", [prov]), /duplicate|unique/);
  await fails(db.query("insert into public.llm_models (provider_id,model_id,display_name) values ($1,'../../x','bad')", [prov]), /model_id/);
});
ok("moving a step moves its mix row; the default model switches cleanly; model ids are tight and case-insensitively unique");

// existing tables untouched
const cnt = (await db.query("select (select count(*) from public.profiles)::int p, (select count(*) from public.generations)::int g")).rows[0];
assert.equal(cnt.g, 0);
ok("existing tables unaffected");
console.log(`\nALL ${n} HOMEWORK 7 SQL CHECKS PASSED`);
