import { test } from "node:test";
import assert from "node:assert/strict";
import { dropDate, formatCountdown, nextDropReset, nyOffsetMs } from "../src/lib/drop";

const hours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;

test("an ordinary winter day: noon in New York is 12 hours before the reset", () => {
  const now = new Date("2026-11-16T17:00:00Z"); // 12:00 EST
  assert.equal(nextDropReset(now).toISOString(), "2026-11-17T05:00:00.000Z");
  assert.equal(hours(now, nextDropReset(now)), 12);
});

test("an ordinary summer day uses daylight time", () => {
  const now = new Date("2026-07-15T16:00:00Z"); // 12:00 EDT
  assert.equal(nextDropReset(now).toISOString(), "2026-07-16T04:00:00.000Z");
});

test("spring forward: the day is 23 hours long", () => {
  const now = new Date("2026-03-08T05:30:00Z"); // 00:30 EST on the DST day
  assert.equal(dropDate(now), "2026-03-08");
  assert.equal(nextDropReset(now).toISOString(), "2026-03-09T04:00:00.000Z"); // 00:00 EDT
  assert.equal(hours(now, nextDropReset(now)), 22.5); // not 23.5
});

test("fall back: the day is 25 hours long", () => {
  const now = new Date("2026-11-01T04:30:00Z"); // 00:30 EDT on the DST day
  assert.equal(dropDate(now), "2026-11-01");
  assert.equal(nextDropReset(now).toISOString(), "2026-11-02T05:00:00.000Z"); // 00:00 EST
  assert.equal(hours(now, nextDropReset(now)), 24.5); // not 23.5
});

test("exactly at the reset the new day has begun, so the next reset is a full day away", () => {
  const reset = new Date("2026-11-17T05:00:00Z");
  assert.equal(dropDate(new Date(reset.getTime() - 1000)), "2026-11-16");
  assert.equal(dropDate(reset), "2026-11-17");
  assert.equal(nextDropReset(reset).toISOString(), "2026-11-18T05:00:00.000Z");
  assert.equal(nextDropReset(new Date(reset.getTime() - 1000)).toISOString(), reset.toISOString());
});

test("the offset is -5h in winter and -4h in summer", () => {
  assert.equal(nyOffsetMs(new Date("2026-01-10T12:00:00Z")), -5 * 3_600_000);
  assert.equal(nyOffsetMs(new Date("2026-07-10T12:00:00Z")), -4 * 3_600_000);
});

test("countdown text", () => {
  assert.equal(formatCountdown(27_735_000).text, "07:42:15");
  assert.equal(formatCountdown(0).text, "00:00:00");
  assert.equal(formatCountdown(-5000).text, "00:00:00");
  assert.equal(formatCountdown(59_999).text, "00:00:59");
});
