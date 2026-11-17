import { test } from "node:test";
import assert from "node:assert/strict";
import { moodFor, moodLine } from "../src/lib/mood";
import { REST_INDEX, STORY, TOTAL_MS, nextIndex, phaseOf } from "../src/lib/story";
import { voiceTheme, coverGradient } from "../src/lib/voice-theme";
import {
  arenaGuidance,
  crowdVerdict,
  dashboardGuidance,
  dropGuidance,
  dropVoteGuidance,
  winnerGuidance,
  hallGuidance,
  feedGuidance,
  isQuotaMessage,
  studioGuidance,
  type StudioState,
} from "../src/lib/guidance";

// ---- Transferred from Prompt Chains (the original mascot's logic must behave identically) ----

test("mood is a pure function of real run state (from Prompt Chains)", () => {
  const base = { phase: "idle" as const, hasPhoto: false, stepIndex: -1, total: 4 };
  assert.equal(moodFor(base), "idle");
  assert.equal(moodFor({ ...base, hasPhoto: true }), "curious");
  assert.equal(moodFor({ ...base, phase: "running", stepIndex: 0 }), "thinking");
  assert.equal(moodFor({ ...base, phase: "running", stepIndex: 3 }), "inspired");
  assert.equal(moodFor({ ...base, phase: "done", hasPhoto: true }), "proud");
  assert.equal(moodFor({ ...base, phase: "failed", hasPhoto: true }), "confused");
  for (const m of ["idle", "curious", "squint", "thinking", "inspired", "proud", "confused"] as const) assert.ok(moodLine(m).length > 5);
});

test("the hero story is well-formed and loops (from Prompt Chains)", () => {
  assert.ok(STORY.length >= 8);
  assert.ok(STORY.every((s) => s.ms >= 500 && s.ms <= 6000));
  assert.deepEqual(STORY.slice(0, 5).map((s) => s.id), ["rest", "notice", "approach", "examine", "think"]);
  assert.equal(STORY[REST_INDEX].id, "proud");
  assert.equal(nextIndex(STORY.length - 1), 0);
  assert.ok(TOTAL_MS > 10_000 && TOTAL_MS < 30_000);
  assert.equal(new Set(STORY.map((s) => s.id)).size, STORY.length);
  assert.deepEqual(STORY.map((s) => phaseOf(s.id)), ["rest", "spot", "spot", "spot", "think", "think", "caption", "caption", "rest"]);
});

test("voice themes give each of the six voices a palette (from Prompt Chains)", () => {
  for (const id of ["classic", "roast", "noir", "nature", "grandma", "hype"]) assert.match(voiceTheme(id).to, /^#[0-9a-f]{6}$/);
  assert.deepEqual(voiceTheme("nope"), voiceTheme(null));
  assert.match(coverGradient("roast"), /^linear-gradient\(135deg, #/);
});

// ---- Consumer guidance ----

const idle: StudioState = { signedIn: false, challenge: false, hasPhoto: false, busy: null, hasTakes: false, published: null, error: null };

test("studio guidance follows the real state, in priority order", () => {
  assert.equal(studioGuidance(idle).mood, "idle");
  assert.equal(studioGuidance({ ...idle, hasPhoto: true }).mood, "curious");
  assert.equal(studioGuidance({ ...idle, hasPhoto: true, busy: "generate" }).mood, "thinking");
  assert.match(studioGuidance({ ...idle, hasPhoto: true, busy: "generate" }).line, /three takes/i);
  assert.equal(studioGuidance({ ...idle, hasPhoto: true, busy: "remix", hasTakes: true }).title, "Remixing");
  assert.equal(studioGuidance({ ...idle, hasPhoto: true, hasTakes: true }).mood, "proud");
  assert.match(studioGuidance({ ...idle, hasPhoto: true, hasTakes: true }).line, /Sign in/);
  assert.match(studioGuidance({ ...idle, signedIn: true, hasPhoto: true, hasTakes: true }).line, /publish/i);
  assert.equal(studioGuidance({ ...idle, signedIn: true, hasPhoto: true, hasTakes: true, busy: "publish" }).mood, "thinking");
  assert.equal(studioGuidance({ ...idle, signedIn: true, hasTakes: true, published: { drop: false } }).title, "All done");
  assert.match(studioGuidance({ ...idle, signedIn: true, hasTakes: true, published: { drop: true } }).line, /Drop/);
  // published beats everything; an error beats busy/takes
  assert.equal(studioGuidance({ ...idle, hasTakes: true, error: "x", published: { drop: false } }).mood, "proud");
  assert.equal(studioGuidance({ ...idle, hasTakes: true, busy: "generate", error: "boom" }).mood, "confused");
  assert.equal(studioGuidance({ ...idle, challenge: true, hasPhoto: true }).title, "Caption today's photo");
});

test("a quota refusal is recognised and explained differently for guests and members", () => {
  assert.equal(isQuotaMessage("You've used today's free captions. Sign in for more, or come back tomorrow."), true);
  assert.equal(isQuotaMessage("You've reached today's caption limit. It resets at midnight UTC."), true);
  assert.equal(isQuotaMessage("The Studio is at capacity right now. Please try again a little later."), true);
  assert.equal(isQuotaMessage("Unsupported file type."), false);
  assert.equal(isQuotaMessage(null), false);
  const guest = studioGuidance({ ...idle, hasPhoto: true, error: "You've used today's free captions. Sign in for more." });
  const member = studioGuidance({ ...idle, signedIn: true, hasPhoto: true, error: "You've reached today's caption limit." });
  assert.equal(guest.mood, "confused");
  assert.match(guest.line, /Sign in/);
  assert.doesNotMatch(member.line, /Sign in/);
  assert.equal(studioGuidance({ ...idle, error: "Unsupported file type." }).title, "That didn't work");
});

test("arena guidance reacts to the real result", () => {
  assert.equal(arenaGuidance({ phase: "signed-out" }).mood, "curious");
  assert.equal(arenaGuidance({ phase: "failed" }).mood, "confused");
  assert.equal(arenaGuidance({ phase: "empty" }).mood, "idle");
  assert.equal(arenaGuidance({ phase: "ready" }).mood, "squint");
  assert.equal(arenaGuidance({ phase: "revealed", pairTotal: 10, pairWinnerVotes: 7 }).mood, "proud");
  assert.equal(arenaGuidance({ phase: "revealed", pairTotal: 10, pairWinnerVotes: 5 }).title, "A dead heat");
  assert.equal(arenaGuidance({ phase: "revealed", pairTotal: 10, pairWinnerVotes: 3 }).title, "Bold pick");
  assert.equal(arenaGuidance({ phase: "revealed", pairTotal: 1, pairWinnerVotes: 1 }).title, "You were first");
});

test("drop, feed and dashboard guidance", () => {
  assert.equal(dropGuidance({ signedIn: true, hasChallenge: false, alreadyEntered: false, entries: 0 }).mood, "confused");
  assert.match(dropGuidance({ signedIn: false, hasChallenge: true, alreadyEntered: false, entries: 3 }).line, /Sign in/);
  assert.equal(dropGuidance({ signedIn: true, hasChallenge: true, alreadyEntered: true, entries: 3 }).title, "You're in");
  assert.match(dropGuidance({ signedIn: true, hasChallenge: true, alreadyEntered: false, entries: 3 }).line, /vote/i);
  assert.equal(feedGuidance({ posts: 0, voice: null }).mood, "idle");
  assert.match(feedGuidance({ posts: 0, voice: "noir" }).title, /voice/);
  assert.equal(feedGuidance({ posts: 5, voice: null }).mood, "curious");
  assert.equal(dashboardGuidance({ posts: 0, firstName: "Maya" }).title, "Hi, Maya");
  assert.equal(dashboardGuidance({ posts: 3, firstName: null }).mood, "proud");
});

test("crowdVerdict reports the real tally, never the animation", () => {
  assert.equal(crowdVerdict(1, 1).tone, "first");
  assert.equal(crowdVerdict(10, 9).label, "Flawless caption!");
  assert.equal(crowdVerdict(2, 2).tone, "agree"); // too few judges to call it flawless
  assert.equal(crowdVerdict(10, 6).tone, "agree");
  assert.equal(crowdVerdict(10, 5).tone, "split");
  assert.equal(crowdVerdict(10, 2).tone, "bold");
});

test("arena has intro and fight guidance", () => {
  assert.equal(arenaGuidance({ phase: "intro" }).mood, "inspired");
  assert.match(arenaGuidance({ phase: "fight" }).line, /already counted/);
});

test("the Daily Drop host reacts to real state", () => {
  const base = { signedIn: true, hasChallenge: true, alreadyEntered: false, entries: 3 };
  assert.equal(dropGuidance({ ...base, curtain: "closed" }).mood, "curious");
  assert.equal(dropGuidance({ ...base, curtain: "opening" }).mood, "inspired");
  assert.match(dropGuidance({ ...base, alreadyEntered: true }).line, /midnight/);
  assert.equal(studioGuidance({ signedIn: true, challenge: true, hasPhoto: true, busy: "publish", hasTakes: true, published: null, error: null }).mood, "inspired");
  assert.equal(studioGuidance({ signedIn: true, challenge: true, hasPhoto: true, busy: null, hasTakes: false, published: null, error: null, typing: true }).mood, "thinking");
});

test("voting reactions and the winner awards", () => {
  assert.equal(dropVoteGuidance("up", 0).mood, "proud");
  assert.equal(dropVoteGuidance("down", 1).mood, "squint");
  assert.equal(dropVoteGuidance("fail").mood, "confused");
  assert.notEqual(dropVoteGuidance("up", 0).title, dropVoteGuidance("up", 1).title);
  assert.equal(winnerGuidance({ phase: "none" }).title, "No winner yesterday");
  assert.match(winnerGuidance({ phase: "open", author: "Ava" }).line, /Ava/);
  assert.equal(winnerGuidance({ phase: "drum" }).mood, "inspired");
});

test("the museum curator only talks about what the Hall really contains", () => {
  assert.equal(hallGuidance({ captions: 0, creators: 0 }).title, "The galleries are empty");
  assert.equal(hallGuidance({ captions: 3, creators: 2 }).mood, "proud");
  assert.equal(hallGuidance({ captions: 3, creators: 2, doing: "masterpiece" }).mood, "inspired");
  assert.match(hallGuidance({ captions: 3, creators: 2, doing: "viewing", creator: "Ava" }).line, /Ava/);
  // a podium with only creators (no captions yet) is not "empty"
  assert.notEqual(hallGuidance({ captions: 0, creators: 1 }).title, "The galleries are empty");
});
