// Runs supabase/checks/preflight.sql and postflight.sql against a throw-away database:
// preflight must be clean on today's schema and must flag conflicts on a migrated one;
// postflight must pass on a migrated schema and fail loudly on an unmigrated one.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boot, files } from "./harness.mjs";

const dir = new URL("../../checks/", import.meta.url).pathname;
const pre = readFileSync(dir + "preflight.sql", "utf8");
const post = readFileSync(dir + "postflight.sql", "utf8");
let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const run = async (db, sql) => (await db.query(sql)).rows;
const verdict = (rows) => rows.find((r) => r.chk === "VERDICT");

const base = files.slice(0, 4);
const fresh = await boot(base);
let rows = await run(fresh, pre);
assert.equal(verdict(rows).status === "BLOCK", false, JSON.stringify(rows.filter((r) => r.status === "BLOCK")));
assert.ok(rows.length > 60, `only ${rows.length} rows`);
assert.equal(rows.filter((r) => r.status === "BLOCK").length, 0);
ok(`preflight on today's schema: no blockers (${verdict(rows).detail})`);
let failedLoudly = false;
try { failedLoudly = verdict(await run(fresh, post)).status === "FAIL"; }
catch (e) { failedLoudly = /does not exist/.test(String(e.message)); } // missing tables/columns: an error is a failure too
assert.ok(failedLoudly);
ok("postflight on an UNMIGRATED database fails loudly (error or FAIL verdict), as it should");

const migrated = await boot(files); // base + the four pending migrations
await migrated.query("insert into auth.users (id,email) values ('11111111-0000-4000-8000-111111111111','root@x.com')");
await migrated.query("update public.profiles set is_superadmin = true where id = '11111111-0000-4000-8000-111111111111'");
await migrated.query("insert into private.app_settings values ('quota_secret', $1)", ["x".repeat(40)]);
rows = await run(migrated, post);
const bad = rows.filter((r) => r.status === "FAIL");
assert.deepEqual(bad, [], JSON.stringify(bad, null, 1));
assert.equal(verdict(migrated && rows).status === "PASS" || verdict(rows).status === "WARN", true);
assert.ok(!rows.some((r) => String(r.detail).includes("xxxxxxxx")), "the secret value is never printed");
ok(`postflight on a migrated database: ${verdict(rows).detail}; the secret is never printed`);
rows = await run(migrated, pre);
assert.equal(verdict(rows).status, "BLOCK");
assert.ok(rows.filter((r) => r.status === "BLOCK").some((r) => /llm_models/.test(r.chk)));
ok("preflight on an already-migrated database flags the taken names (conflict detection works)");

// both files are strictly read-only
for (const sql of [pre, post]) {
  // drop comments and string literals, then no statement may start with a write verb
  const code = sql.replace(/--.*$/gm, "").replace(/'(?:[^']|'')*'/g, "''");
  const statements = code.split(";").map((x) => x.trim()).filter(Boolean);
  assert.ok(statements.length >= 1);
  for (const st of statements) assert.match(st, /^(with|select)\b/i, `not a read-only statement: ${st.slice(0, 60)}`);
  assert.doesNotMatch(code, /\b(insert\s+into|delete\s+from|drop\s+(table|function|policy|schema)|truncate|alter\s+table|create\s+(table|function|policy))\b/i);
}
ok("neither check file contains a write statement");
console.log(`\nALL ${n} CHECK-FILE TESTS PASSED`);
