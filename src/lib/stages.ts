// The creative journey a chain takes the user on, in plain language:
//   Your photo -> Creative thinking -> Refined idea -> Final caption
// Chains only store instructions, so each step's stage comes from its place in
// the chain: the first step explores, the last writes the caption, anything in
// between sharpens. Pure and unit-tested.

export type StageKey = "think" | "refine" | "caption";
export type StageIcon = "spark" | "wand" | "quote";

export type Stage = {
  key: StageKey;
  label: string;
  tagline: string;
  icon: StageIcon;
};

const THINK: Stage = { key: "think", label: "Creative thinking", tagline: "Explore angles and ideas", icon: "spark" };
const REFINE: Stage = { key: "refine", label: "Refined idea", tagline: "Sharpen the best idea", icon: "wand" };
const CAPTION: Stage = { key: "caption", label: "Final caption", tagline: "Write the line people will share", icon: "quote" };

export function stageFor(index: number, total: number): Stage {
  if (total <= 1 || index >= total - 1) return CAPTION;
  if (index <= 0) return THINK;
  return REFINE;
}

export function stagesFor(total: number): Stage[] {
  return Array.from({ length: Math.max(total, 0) }, (_, i) => stageFor(i, total));
}

export type Idea = { title: string; text: string; stage: StageKey };

const IDEAS: Idea[] = [
  { stage: "think", title: "Read the scene", text: "Describe what is happening in the photo in two plain sentences." },
  { stage: "think", title: "Spot the funny", text: "List the three funniest details visible in the photo." },
  { stage: "refine", title: "Sharpen it", text: "Pick the funniest angle from the previous step and sharpen it into one punchy idea." },
  { stage: "caption", title: "Write the line", text: "Write the final caption using the best angle." },
];

/** Starter ideas that make sense as the NEXT step of a chain with `existing` steps. */
export function ideasFor(existing: number): Idea[] {
  if (existing <= 0) return IDEAS.filter((i) => i.stage === "think");
  if (existing === 1) return IDEAS.filter((i) => i.stage !== "think");
  return IDEAS.filter((i) => i.stage !== "think").slice(0, 2);
}

export type StageGroup = { stage: Stage; start: number; end: number };

/**
 * Collapses runs of identical stages into one node so long chains stay
 * readable ("Refined idea x3" instead of three identical nodes).
 * `end` is exclusive: the group covers step indexes start..end-1.
 */
export function groupStages(stages: Stage[]): StageGroup[] {
  const groups: StageGroup[] = [];
  stages.forEach((stage, i) => {
    const last = groups.at(-1);
    if (last && last.stage.key === stage.key) last.end = i + 1;
    else groups.push({ stage, start: i, end: i + 1 });
  });
  return groups;
}
