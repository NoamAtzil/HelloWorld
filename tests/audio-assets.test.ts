import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { SOUND_NAMES } from "../src/lib/sound/engine";

const DIR = path.join(process.cwd(), "public", "audio", "arena");

test("every Caption Kombat sound in the manifest has a file", () => {
  for (const name of SOUND_NAMES) assert.ok(existsSync(path.join(DIR, `${name}.m4a`)), `missing ${name}.m4a`);
});

test("the audio payload stays small and each file is non-trivial", () => {
  let total = 0;
  for (const name of SOUND_NAMES) {
    const size = statSync(path.join(DIR, `${name}.m4a`)).size;
    assert.ok(size > 2000, `${name}.m4a looks empty`);
    total += size;
  }
  assert.ok(total < 1_200_000, `audio is ${total} bytes`);
});

test("the announcer lines the direction asks for all exist", () => {
  for (const n of ["v_get_ready", "v_fight", "v_finish_him", "v_ko", "v_wins", "v_next"]) assert.ok(SOUND_NAMES.includes(n as never), n);
});
