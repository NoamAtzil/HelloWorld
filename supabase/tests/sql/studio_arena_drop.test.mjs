import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, as, fails, files } from "./harness.mjs";
let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const db = await boot();

// Idempotent re-run
await db.exec(readFileSync(files.at(-1), "utf8"));
ok("migration 004 is safe to re-run");

const [A, B, C, D] = ["a", "b", "c", "d"].map((c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12));
for (const [u, name] of [[A, "Ann"], [B, "Bob"], [C, "Cy"], [D, "Di"]]) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [u, name + "@x.com"]);
  await db.query("update public.profiles set first_name=$2, last_name='Z' where id=$1", [u, name]);
}
// A historical post (pre-migration shape: no new fields set).
await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','old post',$2,'m')", [A, `${A}/old.jpg`]);
const old = await db.query("select is_public, voice, library_slug, drop_date from public.generations");
assert.deepEqual(old.rows[0], { is_public: false, voice: null, library_slug: null, drop_date: null });
ok("historical posts stay private (is_public=false) after migration");

// ---- Privacy -------------------------------------------------------------
await as(db, null, async () => {
  await fails(db.query("select * from public.generations"), /permission denied/);
  assert.equal((await db.query("select * from public.public_showcase()")).rows.length, 0);
  await fails(db.query("select * from public.feed_posts()"), /permission denied/);
  await fails(db.query("select * from public.arena_next_pair()"), /permission denied/);
  await fails(db.query("select * from public.drop_entries(current_date)"), /permission denied/);
  await fails(db.query("select * from private.ai_usage"), /permission denied/);
  await fails(db.query("select * from public.consume_user_quota('x')"), /permission denied/);
});
ok("logged-out visitors see nothing private; signed-in-only RPCs are refused");

await as(db, A, async () => {
  await db.query("insert into public.generations (user_id,prompt,content,image_path,model,is_public,voice) values ($1,'p','shared one',$2,'m',true,'noir')", [A, `${A}/new.jpg`]);
  await fails(db.query("update public.generations set is_public = true where user_id=$1", [A]), /permission denied/);
});
await as(db, null, async () => {
  const r = await db.query("select * from public.public_showcase()");
  assert.deepEqual(r.rows.map((x) => x.content), ["shared one"]);
  assert.equal((await db.query("select * from public.public_post(1)")).rows.length, 0, "private post not exposed");
  assert.equal((await db.query("select * from public.public_post(2)")).rows.length, 1);
});
ok("only explicitly shared posts reach logged-out visitors; is_public cannot be flipped later");

// ---- Quotas ---------------------------------------------------------------
const visitor = "v".repeat(40);
const g = async (secret, vis = visitor) => (await db.query("select public.consume_guest_quota($1,$2) as r", [secret, vis])).rows[0].r;
await as(db, null, async () => {
  assert.equal((await g("whatever-whatever-whatever-1234")).reason, "unavailable");
});
ok("guest quota fails closed while no secret is configured");
const SECRET = "s3cret-".repeat(5);
await db.query("insert into private.app_settings values ('quota_secret',$1)", [SECRET]);
await as(db, null, async () => {
  assert.equal((await g("wrong-secret-wrong-secret-wrong")).allowed, false);
  assert.equal((await g("wrong-secret-wrong-secret-wrong")).reason, "unavailable");
  const r1 = await g(SECRET); assert.deepEqual([r1.allowed, r1.remaining], [true, 2]);
  const r2 = await g(SECRET); assert.deepEqual([r2.allowed, r2.remaining], [true, 1]);
  const r3 = await g(SECRET); assert.deepEqual([r3.allowed, r3.remaining], [true, 0]);
  const r4 = await g(SECRET); assert.deepEqual([r4.allowed, r4.reason], [false, "visitor_limit"]);
  const other = await g(SECRET, "w".repeat(40)); assert.equal(other.allowed, true);
  assert.equal((await g(SECRET, "short")).allowed, false);
});
ok("per-visitor cap (3/day) enforced; wrong secret and malformed visitor id refused; other visitors unaffected");
ok("refused calls do not consume the shared budgets");
const tot = await db.query("select calls from private.ai_usage where scope='total'");
assert.equal(tot.rows[0].calls, 4); // 3 + 1 other visitor; the refused 4th was given back
await db.query("update private.app_settings set value='4' where key='guest_global_daily'");
await as(db, null, async () => {
  const r = await g(SECRET, "x".repeat(40)); // global guest: already 4 used
  assert.deepEqual([r.allowed, r.reason], [false, "busy"]);
});
ok("global guest budget enforced");
await db.query("update private.app_settings set value='2' where key='user_daily'");
const uq = async (u, secret = SECRET) => as(db, u, async () => (await db.query("select public.consume_user_quota($1) as r", [secret])).rows[0].r);
assert.equal((await uq(B, "wrong-wrong-wrong-wrong-wrong-1")).reason, "unavailable");
assert.equal((await uq(B)).allowed, true);
assert.equal((await uq(B)).remaining, 0);
assert.equal((await uq(B)).reason, "user_limit");
assert.equal((await uq(C)).allowed, true);
ok("signed-in per-user cap enforced, independent per user, and a member cannot spend it without the server secret");
await db.query("update private.app_settings set value='1' where key='global_daily'");
assert.equal((await uq(D)).reason, "busy");
ok("global ceiling applies to signed-in users too");
await db.query("update private.app_settings set value='400' where key='global_daily'");

// ---- Daily Drop -----------------------------------------------------------
const today = (await db.query("select public.drop_today() d")).rows[0].d.toISOString().slice(0, 10);
const ins = (u, extra) => db.query(`insert into public.generations (user_id,prompt,content,image_path,model,library_slug,drop_date) values ($1,'p',$2,$3,'m',$4,$5)`, [u, extra.c, `${u}/${extra.c}.jpg`, extra.slug ?? null, extra.date ?? null]);
await as(db, A, async () => {
  await fails(ins(A, { c: "yday", slug: "img.jpg", date: "2000-01-01" }), /only be made for today/);
  await fails(ins(A, { c: "noslug", date: today }), /drop_needs_slug/);
  await ins(A, { c: "a-drop", slug: "img.jpg", date: today });
  await fails(ins(A, { c: "a-drop2", slug: "img.jpg", date: today }), /one_drop_entry_per_user|duplicate key/);
});
await as(db, B, async () => { await ins(B, { c: "b-drop", slug: "img.jpg", date: today }); });
ok("Drop entries: today only, needs the challenge image, one per person per day");
const dropIds = (await db.query("select id, user_id from public.generations where drop_date is not null order by id")).rows;
const aDrop = dropIds.find((r) => r.user_id === A).id, bDrop = dropIds.find((r) => r.user_id === B).id;
await as(db, A, async () => {
  await fails(db.query("insert into public.votes (user_id,generation_id,value) values ($1,$2,1)", [A, aDrop]), /own daily drop entry/);
  await db.query("insert into public.votes (user_id,generation_id,value) values ($1,$2,1)", [A, bDrop]);
  // voting on a non-drop post (own, historical) still behaves as before
  await db.query("insert into public.votes (user_id,generation_id,value) values ($1,1,1)", [A]);
});
ok("cannot vote on your own Drop entry; ordinary votes unchanged (even self-votes on normal posts, as before)");
await as(db, C, async () => {
  const e = (await db.query("select * from public.drop_entries($1)", [today])).rows;
  assert.equal(e.length, 2);
  assert.equal(e[0].content, "b-drop"); assert.equal(Number(e[0].score), 1);
  assert.equal((await db.query("select * from public.drop_winners(5)")).rows.length, 0, "today has no winner yet");
});
// close the day: move entries to yesterday (as admin role)
await db.query("update public.generations set drop_date = public.drop_today() - 1 where drop_date is not null");
await as(db, C, async () => {
  await fails(db.query("insert into public.votes (user_id,generation_id,value) values ($1,$2,1)", [C, bDrop]), /voting for that daily drop is closed/);
  const w = (await db.query("select * from public.drop_winners(5)")).rows;
  assert.equal(w.length, 1); assert.equal(w[0].content, "b-drop");
});
ok("voting closes at day end; winner = highest positive score; empty/zero-score days produce no winner");
await db.query("delete from public.generations where id=$1", [bDrop]); // cascades its votes even though the day is closed
await as(db, C, async () => { assert.equal((await db.query("select * from public.drop_winners(5)")).rows.length, 0); });
ok("deleting a closed-day entry still cascades; zero-score day -> no winner (nothing fabricated)");
assert.equal((await db.query("select public.drop_summary($1) c", [today])).rows[0].c, 0);

// ---- Arena ----------------------------------------------------------------
await as(db, B, async () => { await ins(B, { c: "b-pic1", slug: "pic1.jpg" }); });
await as(db, C, async () => { await ins(C, { c: "c-pic1", slug: "pic1.jpg" }); });
await as(db, D, async () => { await ins(D, { c: "d-pic1", slug: "pic1.jpg" }); });
const ids = Object.fromEntries((await db.query("select id, content from public.generations")).rows.map((r) => [r.content, r.id]));
await as(db, A, async () => {
  for (let i = 0; i < 20; i++) {
    const p = (await db.query("select * from public.arena_next_pair()")).rows;
    assert.equal(p.length, 2); assert.equal(p[0].same_image, true);
    assert.equal(p[0].library_slug, p[1].library_slug);
    assert.ok(!p.some((r) => ["old post", "shared one", "a-drop"].includes(r.content)), "never own posts");
    assert.ok(!("user_id" in p[0]), "authors hidden before voting");
  }
});
ok("pairs share an image, never include your own posts, hide authors");
await as(db, A, async () => {
  await fails(db.query("insert into public.duel_votes (user_id,winner_id,loser_id) values ($1,$2,$3)", [A, ids["b-pic1"], ids["c-pic1"]]), /permission denied/);
  const r = (await db.query("select public.arena_vote($1,$2) r", [ids["b-pic1"], ids["c-pic1"]])).rows[0].r;
  assert.equal(r.pair_total, 1); assert.equal(r.pair_winner_votes, 1);
  assert.equal(r.winner.author, "Bob"); assert.equal(r.winner.wins, 1); assert.equal(r.loser.wins, 0);
  await fails(db.query("select public.arena_vote($1,$2)", [ids["c-pic1"], ids["b-pic1"]]), /already judged/);
  await fails(db.query("select public.arena_vote($1,$2)", [ids["b-pic1"], ids["b-pic1"]]), /invalid pair/);
  await fails(db.query("select public.arena_vote($1,$2)", [ids["shared one"], ids["b-pic1"]]), /own caption/);
  await fails(db.query("select public.arena_vote($1,$2)", [9999, ids["b-pic1"]]), /not found/);
});
ok("arena vote: direct inserts denied; reveal is real; duplicates (either order), self, same-post and unknown ids refused");
await as(db, D, async () => {
  const r = (await db.query("select public.arena_vote($1,$2) r", [ids["b-pic1"], ids["c-pic1"]])).rows[0].r;
  assert.equal(r.pair_total, 2); assert.equal(r.winner.battles, 2);
  await fails(db.query("update public.duel_votes set winner_id = loser_id"), /permission denied/);
  await fails(db.query("delete from public.duel_votes"), /permission denied/);
  assert.equal((await db.query("select * from public.duel_votes")).rows.length, 1, "RLS: only own duel votes");
});
ok("tallies are real; duel votes are append-only and private to their owner");
await as(db, A, async () => {
  await db.query("select public.arena_vote($1,$2)", [ids["b-pic1"], ids["d-pic1"]]);
  await db.query("select public.arena_vote($1,$2)", [ids["c-pic1"], ids["d-pic1"]]);
  const p = (await db.query("select * from public.arena_next_pair()")).rows;
  // all same-image pairs judged -> falls back to a mixed pair of OTHER people's posts (here: Bob's drop entry vs Cy's etc.)
  assert.ok(p.length === 0 || p[0].same_image === false);
});
ok("when every same-image pair is judged the arena falls back (or reports nothing left)");

// ---- Reads ---------------------------------------------------------------
await as(db, B, async () => {
  const mine = (await db.query("select * from public.my_captions()")).rows;
  assert.ok(mine.every((r) => r.content.startsWith("b-")));
  const top = mine.find((r) => r.content === "b-pic1");
  assert.equal(Number(top.arena_wins), 3); assert.equal(Number(top.arena_battles), 3);
  const hall = (await db.query("select * from public.hall_arena(0)")).rows;
  assert.equal(hall[0].content, "b-pic1");
  assert.ok((await db.query("select * from public.feed_posts()")).rows.length >= 5);
  await db.query("select * from public.hall_top_captions(7)"); await db.query("select * from public.hall_creators(0)");
});
ok("my_captions / hall_* / feed_posts return real aggregates");

// ---- Regressions from the adversarial review -----------------------------
const [X, Y] = ["e", "f"].map((c) => c.repeat(8) + "-0000-4000-8000-" + c.repeat(12));
for (const [u, name] of [[X, "Xan"], [Y, "Yu"]]) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [u, name + "@x.com"]);
  await db.query("update public.profiles set first_name=$2 where id=$1", [u, name]);
}
await as(db, X, async () => {
  await db.query("insert into public.generations (user_id,prompt,content,image_path,model,library_slug,drop_date,created_at) values ($1,'p','x entry',$2,'m','s.jpg',public.drop_today(),'2999-01-01')", [X, `${X}/e.jpg`]);
  await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','x other',$2,'m')", [X, `${X}/o.jpg`]);
});
const xe = (await db.query("select id, created_at from public.generations where content='x entry'")).rows[0];
assert.ok(xe.created_at < new Date("2100-01-01"), "created_at is the server's");
ok("clients cannot forge created_at");
const other = (await db.query("select id from public.generations where content='x other'")).rows[0].id;
await as(db, Y, async () => {
  await fails(db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','trav',$2,'m')", [Y, `${Y}/../../x/y`]), /image_path_shape|image_path_owner/);
  await fails(db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','trav',$2,'m')", [Y, `${Y}/a b.jpg`]), /image_path_shape/);
  await db.query("insert into public.generations (user_id,prompt,content,image_path,model) values ($1,'p','fine',$2,'m')", [Y, `${Y}/fine.jpg`]);
  await db.query("insert into public.votes (user_id,generation_id,value) values ($1,$2,1)", [Y, xe.id]);
  await fails(db.query("update public.votes set generation_id=$1 where user_id=$2", [other, Y]), /cannot be moved/);
  await db.query("update public.votes set value=-1 where user_id=$1 and generation_id=$2", [Y, xe.id]);
});
ok("image paths cannot traverse; a vote cannot be retargeted (the closed-Drop loophole), but can still be flipped on an open day");
const votesCreated = (await db.query("select created_at from public.votes where user_id=$1", [Y])).rows[0].created_at;
assert.ok(Math.abs(Date.now() - votesCreated.getTime()) < 120000);
ok("vote timestamps are the server's");
console.log(`\nALL ${n} SQL CHECKS PASSED`);
