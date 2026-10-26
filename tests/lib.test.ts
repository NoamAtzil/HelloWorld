import { test } from "node:test";
import assert from "node:assert/strict";
import { dayNumber, dropDate, pickChallenge, shiftDate } from "../src/lib/drop";
import { clientIp, ipBucket, visitorKey } from "../src/lib/visitor";
import { parseSingle, parseTakes } from "../src/lib/takes";
import { safeNextPath } from "../src/lib/next-path";
import { detectImageType } from "../src/lib/image";

const lib = ["c.jpg", "a.jpg", "b.jpg"].map((file) => ({ file, title: file }));

test("dropDate uses America/New_York, not UTC", () => {
  // 03:30 UTC on Jan 2 is still Jan 1 evening in New York.
  assert.equal(dropDate(new Date("2026-01-02T03:30:00Z")), "2026-01-01");
  // 05:00 UTC is exactly midnight Eastern (EST, UTC-5): the new day begins.
  assert.equal(dropDate(new Date("2026-01-02T04:59:59Z")), "2026-01-01");
  assert.equal(dropDate(new Date("2026-01-02T05:00:00Z")), "2026-01-02");
  // Daylight saving: EDT is UTC-4.
  assert.equal(dropDate(new Date("2026-07-02T03:59:59Z")), "2026-07-01");
  assert.equal(dropDate(new Date("2026-07-02T04:00:00Z")), "2026-07-02");
});

test("shiftDate crosses month and year boundaries", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
});

test("pickChallenge is deterministic, cycles through the library, and honors valid overrides", () => {
  const a = pickChallenge("2026-05-10", lib)!.file;
  assert.equal(pickChallenge("2026-05-10", lib)!.file, a);
  const seen = new Set([0, 1, 2].map((i) => pickChallenge(shiftDate("2026-05-10", i), lib)!.file));
  assert.equal(seen.size, 3, "three consecutive days use three different images");
  // the same image does not depend on the order the library is listed in
  assert.equal(pickChallenge("2026-05-10", [...lib].reverse())!.file, a);
  assert.equal(pickChallenge("2026-05-10", lib, "b.jpg")!.file, "b.jpg");
  assert.equal(pickChallenge("2026-05-10", lib, "gone.jpg")!.file, a, "unknown override falls back");
  assert.equal(pickChallenge("2026-05-10", []), null);
  assert.equal(dayNumber("1970-01-02"), 1);
});

test("ipBucket groups IPv6 by /64 and leaves IPv4 alone", () => {
  assert.equal(ipBucket("203.0.113.7"), "203.0.113.7");
  assert.equal(ipBucket("2001:db8:abcd:12::1"), ipBucket("2001:db8:abcd:12:ffff:ffff:ffff:ffff"));
  assert.notEqual(ipBucket("2001:db8:abcd:12::1"), ipBucket("2001:db8:abcd:13::1"));
  assert.equal(ipBucket("::1"), "0000:0000:0000:0000::/64");
});

test("visitorKey is salted, stable, and never contains the IP", () => {
  const k = visitorKey("203.0.113.7", "secret-one-secret-one-secret");
  assert.equal(k, visitorKey("203.0.113.7", "secret-one-secret-one-secret"));
  assert.notEqual(k, visitorKey("203.0.113.7", "secret-two-secret-two-secret"));
  assert.notEqual(k, visitorKey("203.0.113.8", "secret-one-secret-one-secret"));
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.ok(!k.includes("203"));
  assert.match(visitorKey(null, "secret-one-secret-one-secret"), /^[0-9a-f]{64}$/);
});

test("clientIp trusts only the host's own header", () => {
  const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
  const spoof = h({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9", "x-real-ip": "8.8.8.8" });
  assert.equal(clientIp(spoof, { VERCEL: "1" }), "1.1.1.1");
  // Off Vercel, client-settable headers are ignored in production...
  assert.equal(clientIp(spoof, { NODE_ENV: "production" }), null);
  assert.equal(clientIp(spoof, {}), null);
  // ...unless the operator names the trusted header for their host.
  assert.equal(clientIp(h({ "x-nf-client-connection-ip": "3.3.3.3" }), { TRUSTED_IP_HEADER: "X-NF-Client-Connection-IP" }), "3.3.3.3");
  assert.equal(clientIp(h({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }), { NODE_ENV: "development" }), "2.2.2.2");
});

test("parseTakes accepts the requested JSON, de-duplicates, trims, and caps", () => {
  assert.deepEqual(parseTakes('{"captions":[" \\"One\\" ","Two","two","Three","Four"]}'), ["One", "Two", "Three"]);
  assert.deepEqual(parseTakes('```json\n{"captions":["A","B"]}\n```'), ["A", "B"]);
  assert.deepEqual(parseTakes('["x","y","z"]'), ["x", "y", "z"]);
  assert.deepEqual(parseTakes("not json"), []);
  assert.deepEqual(parseTakes(undefined), []);
  assert.deepEqual(parseTakes('{"captions":["",null,5]}'), ["5"]);
  assert.ok(parseTakes(JSON.stringify({ captions: ["x".repeat(900)] }))[0].length <= 300);
});

test("parseSingle takes the first non-empty line", () => {
  assert.equal(parseSingle('\n"Hello there"\nextra'), "Hello there");
  assert.equal(parseSingle(""), "");
});

test("safeNextPath only allows same-site paths", () => {
  assert.equal(safeNextPath("/studio"), "/studio");
  assert.equal(safeNextPath("/drop?x=1"), "/drop?x=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "evil", "", null, undefined, "/a\nb"]) {
    assert.equal(safeNextPath(bad as string | null | undefined), null, String(bad));
  }
});

test("detectImageType reads magic bytes, not names", () => {
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext, "jpg");
  assert.equal(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.ext, "png");
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(detectImageType(webp)?.ext, "webp");
  assert.equal(detectImageType(new Uint8Array([1, 2, 3, 4])), null);
});
