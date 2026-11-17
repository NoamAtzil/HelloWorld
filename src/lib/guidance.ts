import type { Mood } from "./mood";

// What the Caption Creature says and how it feels on each page. Everything here
// is a pure function of REAL application state (never timers or randomness), so
// the mascot reacts to what the person is actually doing. Same voice as in the
// Prompt Chains app: short, warm, a little mischievous, and always pointing at
// the next useful step. Unit-tested.

export type Guidance = { mood: Mood; title: string; line: string };

// The server's own wording for "you can't generate right now" (see lib/quota.ts).
export function isQuotaMessage(message: string | null | undefined): boolean {
  return Boolean(message && /today.?s free captions|caption limit|at capacity|unavailable/i.test(message));
}

export type StudioState = {
  signedIn: boolean;
  /** Daily Drop mode: the photo is fixed to today's challenge. */
  challenge: boolean;
  hasPhoto: boolean;
  busy: null | "generate" | "remix" | "publish" | "card";
  hasTakes: boolean;
  published: null | { drop: boolean };
  error: string | null;
  /** Daily Drop: the person has typed a direction but not generated yet. */
  typing?: boolean;
};

export function studioGuidance(s: StudioState): Guidance {
  if (s.published) {
    return {
      mood: "proud",
      title: "All done",
      line: s.published.drop ? "You're in today's Drop. Go see how the votes land." : "Published! Go see how it lands in the feed.",
    };
  }
  if (s.error) {
    return isQuotaMessage(s.error)
      ? { mood: "confused", title: "That's the limit for now", line: s.signedIn ? "I'm out of captions for today. Come back tomorrow." : "I'm out of free captions today. Sign in for more." }
      : { mood: "confused", title: "That didn't work", line: "Hm. That didn't go to plan. Try again." };
  }
  switch (s.busy) {
    case "generate":
      return { mood: "thinking", title: "Making your captions", line: "Reading the photo and writing three takes…" };
    case "remix":
      return { mood: "thinking", title: "Remixing", line: "Rewriting that one…" };
    case "publish":
      return s.challenge
        ? { mood: "inspired", title: "Entering you in!", line: "Getting your entry stamped…" }
        : { mood: "thinking", title: "Publishing", line: "Putting it in the feed…" };
    case "card":
      return { mood: "thinking", title: "Making your card", line: "Framing it for sharing…" };
  }
  if (s.typing && !s.hasTakes) return { mood: "thinking", title: "Hmm, interesting…", line: "Good direction. Hit generate when you're ready." };
  if (s.hasTakes) {
    return {
      mood: "proud",
      title: "Three takes ready",
      line: s.signedIn ? "Switch between takes, remix one, then publish your favorite." : "Switch between takes. Sign in to remix, publish and vote.",
    };
  }
  if (s.hasPhoto) {
    return {
      mood: "curious",
      title: s.challenge ? "Caption today's photo" : "Make a caption",
      line: s.challenge ? "Pick a voice, then generate. One entry per day." : "Pick a voice, steer the joke if you like, then generate.",
    };
  }
  return { mood: "idle", title: "Make a caption", line: "Pick a photo, or upload your own, and I'll find the joke." };
}

export type ArenaState =
  | { phase: "signed-out" }
  | { phase: "failed" }
  | { phase: "empty" }
  | { phase: "ready" }
  | { phase: "intro" }
  | { phase: "fight" }
  | { phase: "revealed"; pairTotal: number; pairWinnerVotes: number };

export function arenaGuidance(s: ArenaState): Guidance {
  switch (s.phase) {
    case "signed-out":
      return { mood: "curious", title: "The Arena", line: "Two captions, one photo. Sign in and tell me which is funnier." };
    case "failed":
      return { mood: "confused", title: "Couldn't load a battle", line: "Something went wrong. Give it another try." };
    case "empty":
      return { mood: "idle", title: "No battles right now", line: "You've judged everything for now. Check back soon." };
    case "ready":
      return { mood: "squint", title: "Which one's funnier?", line: "Tap the caption that made you laugh. You'll see who wrote each." };
    case "intro":
      return { mood: "inspired", title: "Ready to rumble?", line: "Two captions step into the ring. Pick the funnier one." };
    case "fight":
      return { mood: "curious", title: "Fight!", line: "Your vote is already counted. The showdown is just for show." };
    case "revealed": {
      if (s.pairTotal <= 1) return { mood: "curious", title: "You were first", line: "You're the first to judge this pair. Next battle?" };
      if (s.pairWinnerVotes * 2 > s.pairTotal) return { mood: "proud", title: "The crowd agrees", line: "Most people picked the same one. Next battle?" };
      if (s.pairWinnerVotes * 2 === s.pairTotal) return { mood: "curious", title: "A dead heat", line: "The crowd is split right down the middle. Next battle?" };
      return { mood: "squint", title: "Bold pick", line: "The crowd went the other way. Next battle?" };
    }
  }
}

/**
 * What the real crowd did, in one honest headline. This is about the actual vote
 * tally, never the animated showdown (which your pick always wins).
 */
export function crowdVerdict(total: number, winnerVotes: number): { label: string; tone: "first" | "great" | "agree" | "split" | "bold" } {
  if (total <= 1) return { label: "First to judge", tone: "first" };
  const pct = (winnerVotes / total) * 100;
  if (total >= 3 && pct >= 80) return { label: "Flawless caption!", tone: "great" };
  if (winnerVotes * 2 > total) return { label: "The crowd agrees", tone: "agree" };
  if (winnerVotes * 2 === total) return { label: "A dead heat", tone: "split" };
  return { label: "Bold pick", tone: "bold" };
}

export type DropState = {
  signedIn: boolean;
  hasChallenge: boolean;
  alreadyEntered: boolean;
  entries: number | null;
  /** The show's curtain, during the daily entrance. */
  curtain?: "closed" | "opening" | "open";
};

export function dropGuidance(s: DropState): Guidance {
  if (s.curtain === "closed") return { mood: "curious", title: "The show is about to begin", line: "Raise the curtain whenever you're ready." };
  if (s.curtain === "opening") return { mood: "inspired", title: "Ladies and gentlemen!", line: "Welcome to the Daily Drop. One photo, one caption, one day." };
  if (!s.hasChallenge) return { mood: "confused", title: "No challenge today", line: "There's no photo to caption today. Check back tomorrow." };
  if (!s.signedIn) return { mood: "curious", title: "Today's challenge", line: "One photo a day, one caption each. Sign in to enter and vote." };
  if (s.alreadyEntered) return { mood: "proud", title: "You're in", line: "Your caption is entered. Vote on the others, then come back after midnight Eastern for the results." };
  return { mood: "curious", title: "Today's challenge", line: "Caption the photo, then vote on other entries. One entry per day." };
}

/** The host's reaction to a real vote. `n` is how many votes this person has cast here, to vary the lines. */
export function dropVoteGuidance(kind: "up" | "down" | "undo" | "fail", n = 0): Guidance {
  const pick = <T,>(list: T[]) => list[Math.abs(n) % list.length];
  switch (kind) {
    case "up":
      return pick<Guidance>([
        { mood: "proud", title: "Applause!", line: "The judges loved that one." },
        { mood: "inspired", title: "Ooh!", line: "A fan favorite, folks." },
        { mood: "proud", title: "Nicely judged", line: "You have taste. Keep voting." },
      ]);
    case "down":
      return pick<Guidance>([
        { mood: "squint", title: "Tough room", line: "That one didn't land with you." },
        { mood: "squint", title: "Ouch", line: "Comedy is hard. The votes are real." },
      ]);
    case "undo":
      return { mood: "curious", title: "Changed your mind?", line: "Totally fair. Judges are allowed to." };
    case "fail":
      return { mood: "confused", title: "The mic cut out", line: "That vote didn't go through. Try again." };
  }
}

export type WinnerPhase = "none" | "closed" | "drum" | "open";

/** The host at the awards: only ever about a winner the database actually named. */
export function winnerGuidance(s: { phase: WinnerPhase; author?: string }): Guidance {
  switch (s.phase) {
    case "none":
      return { mood: "idle", title: "No winner yesterday", line: "The stage was empty. Tonight could change that." };
    case "closed":
      return { mood: "curious", title: "Yesterday's winner", line: "Ready to find out who it was?" };
    case "drum":
      return { mood: "inspired", title: "And the winner is…", line: "Drumroll, please." };
    case "open":
      return { mood: "proud", title: "Congratulations!", line: s.author ? `Yesterday's best caption, by ${s.author}.` : "Yesterday's best caption." };
  }
}

export function feedGuidance(s: { posts: number; voice: string | null }): Guidance {
  if (s.posts === 0) {
    return s.voice
      ? { mood: "idle", title: "Nothing in that voice yet", line: "Try another voice, or make the first one yourself." }
      : { mood: "idle", title: "The feed is quiet", line: "No captions yet. Make the first one in the Studio." };
  }
  return { mood: "curious", title: "The feed", line: "Browse captions and vote on what lands. Filter by voice, or tap Surprise me." };
}

export const HALL_GUIDANCE: Guidance = { mood: "proud", title: "Hall of Fame", line: "The captions, battles and creators that landed best." };

export type HallState = {
  /** Real counts from the leaderboards. */
  captions: number;
  creators: number;
  /** What the visitor is doing right now. */
  doing?: "idle" | "viewing" | "masterpiece";
  creator?: string;
};

/** The curator's lines: always about what the Hall really contains. */
export function hallGuidance(s: HallState): Guidance {
  if (s.doing === "masterpiece") return { mood: "inspired", title: "Ah, the masterpiece", line: "Please, no flash photography." };
  if (s.doing === "viewing") return { mood: "curious", title: "A connoisseur", line: s.creator ? `A fine choice. Credit to ${s.creator}.` : "A fine choice. Take your time." };
  if (s.captions === 0 && s.creators === 0) return { mood: "idle", title: "The galleries are empty", line: "Nothing qualifies yet. Vote and battle, and I'll hang the first exhibit." };
  return { mood: "proud", title: "The Hall of Fame", line: "Welcome to the Museum of Legendary Comedy. Mind the exhibits." };
}
export const LOGIN_GUIDANCE: Guidance = { mood: "curious", title: "Welcome", line: "Sign in with Google and I'll remember your captions." };
export const ONBOARDING_GUIDANCE: Guidance = { mood: "curious", title: "One last thing", line: "What should I call you? First and last name, that's all." };

export function dashboardGuidance(s: { posts: number; firstName: string | null }): Guidance {
  return s.posts === 0
    ? { mood: "idle", title: `Hi${s.firstName ? `, ${s.firstName}` : ""}`, line: "You haven't published anything yet. The Studio is one tap away." }
    : { mood: "proud", title: `Hi${s.firstName ? `, ${s.firstName}` : ""}`, line: "Here's everything you've made, and how it's doing." };
}

export const CAPTION_PAGE_GUIDANCE: Guidance = { mood: "proud", title: "A caption worth sharing", line: "Copy it, share it, or make your own." };
