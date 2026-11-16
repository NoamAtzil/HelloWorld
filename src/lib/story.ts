import type { Mood } from "./mood";

// The hero's scripted story, as data (unit-tested). The scene component walks
// these steps in order and loops; CSS reads `data-step` to place the photo, the
// creature and the caption card. When animation is off (reduced motion, or the
// scene is off-screen) the scene shows REST_FRAME: a complete, readable picture.

export type StoryId = "rest" | "notice" | "approach" | "examine" | "think" | "inspire" | "emerge" | "proud" | "fade";

export type StoryStep = { id: StoryId; ms: number; mood: Mood };

export const STORY: readonly StoryStep[] = [
  { id: "rest", ms: 1500, mood: "idle" },
  { id: "notice", ms: 1400, mood: "curious" },
  { id: "approach", ms: 1900, mood: "curious" },
  { id: "examine", ms: 2200, mood: "squint" },
  { id: "think", ms: 2400, mood: "thinking" },
  { id: "inspire", ms: 1100, mood: "inspired" },
  { id: "emerge", ms: 1800, mood: "inspired" },
  { id: "proud", ms: 4200, mood: "proud" },
  { id: "fade", ms: 900, mood: "idle" },
];

/** The frame shown when nothing is animating: photo, creature and caption together. */
export const REST_FRAME: StoryId = "proud";

export const REST_INDEX = STORY.findIndex((s) => s.id === REST_FRAME);

export function nextIndex(i: number): number {
  return (i + 1) % STORY.length;
}

export const TOTAL_MS = STORY.reduce((n, s) => n + s.ms, 0);

export type StoryPhase = "rest" | "spot" | "think" | "caption";

/** Which of the three legend stages (Spot it / Think / Caption) a step belongs to. */
export function phaseOf(id: StoryId): StoryPhase {
  switch (id) {
    case "notice":
    case "approach":
    case "examine":
      return "spot";
    case "think":
    case "inspire":
      return "think";
    case "emerge":
    case "proud":
      return "caption";
    default:
      return "rest";
  }
}
