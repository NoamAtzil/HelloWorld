// The comedic voices the Studio offers. The id is stored on the post
// (generations.voice); the instruction is what the model is told.
export const VOICES = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Clean, quick, easy to get.",
    instruction:
      "Voice: a sharp, friendly observational comic. Clean setup, clear punchline.",
  },
  {
    id: "roast",
    label: "Roast Master",
    blurb: "Affectionate burns.",
    instruction:
      "Voice: a roast-battle host. Tease what is visible with confident, affectionate burns. Never mock anyone's body, appearance, identity, or any protected trait; aim at the situation, the choices, and the vibe.",
  },
  {
    id: "noir",
    label: "Noir Detective",
    blurb: "Rain, regret, a mystery.",
    instruction:
      "Voice: a hard-boiled 1940s noir detective narrating the scene in a weary voiceover, with a dry metaphor.",
  },
  {
    id: "nature",
    label: "Nature Doc",
    blurb: "Hushed wildlife narration.",
    instruction:
      "Voice: a hushed nature-documentary narrator observing these people or things as if they were rare wildlife in their habitat.",
  },
  {
    id: "grandma",
    label: "Passive-Aggressive Grandma",
    blurb: "Sweet. Devastating.",
    instruction:
      "Voice: a sweet grandmother whose gentle remark is quietly devastating. Polite words, savage subtext.",
  },
  {
    id: "hype",
    label: "Sports Announcer",
    blurb: "Everything is the finals.",
    instruction:
      "Voice: an over-the-top live sports commentator treating this mundane moment as a championship play-by-play.",
  },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

export const DEFAULT_VOICE: VoiceId = "classic";

export function isVoiceId(value: unknown): value is VoiceId {
  return VOICES.some((voice) => voice.id === value);
}

export function voiceLabel(id: string | null | undefined) {
  return VOICES.find((voice) => voice.id === id)?.label ?? null;
}

// Creative controls for rewriting a caption that already exists.
export const REMIX_MODES = [
  { id: "shorter", label: "Shorter", instruction: "Make it much shorter and punchier. Cut every word that is not needed." },
  { id: "sharper", label: "Sharper", instruction: "Make the joke sharper and more cutting, while staying good-natured." },
  { id: "weirder", label: "Weirder", instruction: "Make it weirder and more absurd, with a surprising left turn." },
  { id: "pun", label: "Pun it", instruction: "Rewrite it around a clever pun or wordplay." },
  { id: "dramatic", label: "Dramatic", instruction: "Rewrite it as an over-the-top dramatic proclamation." },
] as const;

export type RemixMode = (typeof REMIX_MODES)[number]["id"];

export function isRemixMode(value: unknown): value is RemixMode {
  return REMIX_MODES.some((mode) => mode.id === value);
}

// Starting points for the Shuffle button.
export const DIRECTION_IDEAS = [
  "roast us gently",
  "make it a dramatic movie trailer",
  "as if this were a nature documentary",
  "from the point of view of the nearest object",
  "an overly formal complaint letter",
  "a motivational poster that went wrong",
  "an apology nobody asked for",
  "deadpan, like it's perfectly normal",
  "a breaking news headline",
  "what everyone is secretly thinking",
];
