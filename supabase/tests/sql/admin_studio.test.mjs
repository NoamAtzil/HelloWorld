import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, as, fails, files } from "./harness.mjs";
let n = 0; const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const db = await boot();
await db.exec(readFileSync(files.at(-1), "utf8")); ok("admin migration 002 applies, and is safe to re-run");
const [ADM, REG] = ["1", "2"].map((c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12));
for (const u of [ADM, REG]) await db.query("insert into auth.users (id,email) values ($1,$2)", [u, u.slice(0,4)+"@x.com"]);
await db.query("update public.profiles set first_name='Root', is_superadmin=true where id=$1", [ADM]);
await db.query("update public.profiles set first_name='Reg' where id=$1", [REG]);
const fns = [["admin_challenges()"], ["admin_studio_stats()"], ["admin_drop_history(7)"], ["admin_post_studio(1)"], ["admin_set_challenge(current_date + 5, 'a.jpg', 't')"], ["admin_delete_challenge(current_date + 5)"]];
await as(db, REG, async () => { for (const [f] of fns) await fails(db.query(`select * from public.${f}`), /forbidden|permission denied/); });
ok("regular users are refused by every new admin function");
await as(db, null, async () => { for (const [f] of fns) await fails(db.query(`select * from public.${f}`), /permission denied/); });
ok("anonymous callers cannot execute them");
await as(db, REG, async () => {
  await fails(db.query("insert into public.daily_challenges (drop_date, library_slug) values (current_date + 9, 'x.jpg')"), /permission denied/);
});
ok("nobody can write daily_challenges directly");
await as(db, ADM, async () => {
  await fails(db.query("select public.admin_set_challenge(public.drop_today(), 'a.jpg', null)"), /after today/);
  await fails(db.query("select public.admin_set_challenge(public.drop_today() - 3, 'a.jpg', null)"), /after today/);
  await fails(db.query("select public.admin_set_challenge(public.drop_today() + 3, '../evil', null)"), /invalid/);
  await db.query("select public.admin_set_challenge(public.drop_today() + 3, 'pic.jpg', ' Monday mood ')");
  await db.query("select public.admin_set_challenge(public.drop_today() + 3, 'pic2.jpg', null)");
  const r = (await db.query("select * from public.admin_challenges()")).rows;
  assert.equal(r.length, 1); assert.equal(r[0].library_slug, "pic2.jpg"); assert.equal(r[0].theme, null);
  await fails(db.query("select public.admin_delete_challenge(public.drop_today())"), /future/);
  await db.query("select public.admin_delete_challenge(public.drop_today() + 3)");
  assert.equal((await db.query("select * from public.admin_challenges()")).rows.length, 0);
});
ok("admin can pin/replace/remove FUTURE challenges only; invalid input rejected");
// seed a drop + arena activity then read the stats
const mk = async (u, name) => { await db.query("insert into auth.users (id,email) values ($1,$2)", [u, name]); await db.query("update public.profiles set first_name=$2 where id=$1", [u, name]); };
const [P, Q] = ["3", "4"].map((c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12));
await mk(P, "Pat"); await mk(Q, "Quinn");
await db.query("insert into public.generations (user_id,prompt,content,image_path,model,library_slug,voice,is_public) values ($1,'p','pat caption',$2,'m','s.jpg','noir',true), ($3,'p','quinn caption',$4,'m','s.jpg','hype',false)", [P, `${P}/1.jpg`, Q, `${Q}/1.jpg`]);
await db.query("insert into public.duel_votes (user_id,winner_id,loser_id) select $1, a.id, b.id from public.generations a, public.generations b where a.content='pat caption' and b.content='quinn caption'", [ADM]);
await db.query("insert into private.ai_usage values (current_date,'guest_total','*',7),(current_date,'guest_visitor','abc',3),(current_date,'guest_visitor','def',4),(current_date,'user',$1,5),(current_date,'total','*',12)", [P]);
await as(db, ADM, async () => {
  const s = (await db.query("select public.admin_studio_stats() s")).rows[0].s;
  assert.equal(s.today.guest_calls, 7); assert.equal(s.today.guest_visitors, 2); assert.equal(s.today.user_calls, 5);
  assert.equal(s.content.public_posts, 1); assert.equal(s.arena.battles, 1); assert.equal(s.arena.judges, 1);
  assert.equal(s.caps.guest_global, 100); assert.equal(s.quota_configured, false);
  assert.equal(s.usage_by_day.length, 14); assert.equal(s.voices.length, 2);
  const h = (await db.query("select * from public.admin_drop_history(3)")).rows; assert.equal(h.length, 3);
  const pst = (await db.query("select * from public.admin_post_studio(1)")).rows[0]; assert.equal(Number(pst.arena_battles), 1);
});
ok("studio stats are computed from real rows (quota usage, content, voices, arena)");
// shared-images delete policy
await db.query("insert into storage.objects (bucket_id,name) values ('shared-images', $1)", [`${P}/1.jpg`]);
await as(db, ADM, async () => { await db.query("delete from storage.objects where bucket_id='shared-images'"); });
assert.equal((await db.query("select count(*)::int c from storage.objects")).rows[0].c, 0);
await db.query("insert into storage.objects (bucket_id,name) values ('shared-images', $1)", [`${P}/2.jpg`]);
await as(db, REG, async () => { await db.query("delete from storage.objects where bucket_id='shared-images'"); });
assert.equal((await db.query("select count(*)::int c from storage.objects")).rows[0].c, 1);
ok("superadmins (and only they, besides the owner) can delete shared images");
console.log(`\nALL ${n} ADMIN SQL CHECKS PASSED`);
