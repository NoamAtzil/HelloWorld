// The Caption Creature's mood is a pure function of REAL application state:
// no timers, no randomness. The hero uses the scripted story in story.ts
// instead; everywhere else the creature reflects what the user is doing.

export type Mood = "idle" | "curious" | "squint" | "thinking" | "inspired" | "proud" | "confused";

export type WorkState = {
  phase: "idle" | "running" | "done" | "failed";
  hasPhoto: boolean;
  /** Index of the step currently running (running phase). */
  stepIndex: number;
  total: number;
};

export function moodFor(s: WorkState): Mood {
  if (s.phase === "failed") return "confused";
  if (s.phase === "done") return "proud";
  if (s.phase === "running") {
    // Writing the final caption is the "eureka" moment.
    return s.total > 1 && s.stepIndex >= s.total - 1 ? "inspired" : "thinking";
  }
  return s.hasPhoto ? "curious" : "idle";
}

export function moodLine(mood: Mood): string {
  switch (mood) {
    case "curious":
      return "Ooh, a photo. Let me look.";
    case "thinking":
      return "Thinking it over…";
    case "inspired":
      return "Wait. I've got it.";
    case "proud":
      return "Nailed it, if I say so myself.";
    case "confused":
      return "Hm. That didn't go to plan.";
    case "squint":
      return "Hmm, interesting.";
    default:
      return "Give me a photo and I'll find the joke.";
  }
}
