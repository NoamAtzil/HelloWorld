// Each comedic voice gets a signature color pair, used for chain covers and
// accents so a chain has personality at a glance. All pairs are warm-leaning and
// sit well on cream and on charcoal; text over them always sits on a dark scrim.

export type VoiceTheme = { from: string; to: string; soft: string };

const THEMES: Record<string, VoiceTheme> = {
  classic: { from: "#ffb15c", to: "#e8590c", soft: "#ffe3c4" },
  roast: { from: "#ff7a59", to: "#b3261e", soft: "#ffd9cf" },
  noir: { from: "#7f8da3", to: "#2b323c", soft: "#dde3ec" },
  nature: { from: "#a5c985", to: "#4b7a47", soft: "#e2efd6" },
  grandma: { from: "#f5aebd", to: "#b0517a", soft: "#fbdde6" },
  hype: { from: "#ffd36b", to: "#ee8512", soft: "#fff0c2" },
};

const NEUTRAL: VoiceTheme = { from: "#ffc384", to: "#d9480f", soft: "#ffe8d0" };

export function voiceTheme(id: string | null | undefined): VoiceTheme {
  return (id && THEMES[id]) || NEUTRAL;
}

export function coverGradient(id: string | null | undefined) {
  const t = voiceTheme(id);
  return `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`;
}
