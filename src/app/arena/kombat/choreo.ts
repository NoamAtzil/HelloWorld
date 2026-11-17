// The choreography for CAPTION KOMBAT. Poses are sets of joint angles (CSS
// variables on the fighter, interpolated by CSS transitions); body-level motion
// (dashes, jumps, flights, spins) is the Web Animations API on the fighter's
// rig. Every move has: anticipation, an action, an impact with a reaction, and
// an aftermath. Cartoon only: stars, flashes, dust, comic words. No gore.

export type MoveName = "uppercut" | "roundhouse" | "bonk";
export const MOVES: readonly MoveName[] = ["uppercut", "roundhouse", "bonk"];

/** Pick a move at random, avoiding the one used last when possible. */
export function pickMove(last: MoveName | null, rand: () => number = Math.random): MoveName {
  const pool = MOVES.filter((m) => m !== last);
  return pool[Math.floor(rand() * pool.length)] ?? MOVES[0];
}

export type PoseKey = "tr" | "b1" | "b2" | "f1" | "f2" | "lb1" | "lb2" | "lf1" | "lf2" | "hr";
export type Pose = Partial<Record<PoseKey, number>>;

// Angles in degrees. Arms and legs hang down from their joint, so a NEGATIVE
// angle swings them forward (toward the opponent). The torso leans forward with
// a POSITIVE angle. f = front arm, b = back arm; lf/lb = front/back leg.
export const POSE = {
  folded: { tr: 0, b1: 0, b2: 0, f1: 0, f2: 0, lb1: 0, lb2: 0, lf1: 0, lf2: 0, hr: 0 },
  stance: { tr: 4, b1: -38, b2: -104, f1: -58, f2: -86, lb1: 17, lb2: -13, lf1: -21, lf2: 27, hr: -2 },
  brace: { tr: -6, b1: -50, b2: -120, f1: -70, f2: -100, lb1: 22, lb2: -18, lf1: -16, lf2: 30, hr: 4 },
  scared: { tr: -10, b1: -150, b2: -25, f1: -160, f2: -20, lb1: 18, lb2: -30, lf1: -8, lf2: 34, hr: 6 },
  // uppercut
  upWind: { tr: -10, b1: -64, b2: -98, f1: 38, f2: 18, lb1: 30, lb2: -52, lf1: -44, lf2: 60, hr: -8 },
  upHit: { tr: 18, b1: -22, b2: -112, f1: -112, f2: -46, lb1: 12, lb2: -8, lf1: -10, lf2: 12, hr: 9 },
  upTop: { tr: 14, b1: -24, b2: -110, f1: -138, f2: -20, lb1: 10, lb2: -6, lf1: -8, lf2: 10, hr: 8 },
  // roundhouse
  rWind: { tr: -20, b1: -52, b2: -104, f1: -42, f2: -98, lb1: 42, lb2: -56, lf1: -12, lf2: 34, hr: -9 },
  rKick: { tr: -34, b1: 38, b2: -6, f1: -74, f2: -16, lb1: 10, lb2: -10, lf1: -112, lf2: -6, hr: 8 },
  // bonk
  reach: { tr: 4, b1: -30, b2: -100, f1: -86, f2: -62, lb1: 17, lb2: -13, lf1: -21, lf2: 27, hr: -2 },
  bonkUp: { tr: -12, b1: -44, b2: -108, f1: -150, f2: -34, lb1: 24, lb2: -26, lf1: -26, lf2: 40, hr: -10 },
  bonkSwing: { tr: 10, b1: -22, b2: -90, f1: -122, f2: 40, lb1: 6, lb2: -6, lf1: -18, lf2: 18, hr: 12 },
  // reactions
  hurt: { tr: -26, b1: -140, b2: -22, f1: -152, f2: -28, lb1: 52, lb2: -30, lf1: -62, lf2: 42, hr: -34 },
  flail: { tr: 22, b1: -176, b2: -8, f1: -98, f2: 22, lb1: -46, lb2: 30, lf1: 42, lf2: -40, hr: 32 },
  squashed: { tr: 0, b1: 62, b2: 20, f1: 70, f2: 24, lb1: 30, lb2: -10, lf1: -30, lf2: 10, hr: 0 },
  victory: { tr: 6, b1: -26, b2: -84, f1: -134, f2: -20, lb1: 12, lb2: -14, lf1: -16, lf2: 20, hr: -9 },
  victory2: { tr: 4, b1: -138, b2: -22, f1: -138, f2: -22, lb1: 14, lb2: -12, lf1: -14, lf2: 18, hr: 8 },
} satisfies Record<string, Pose>;

const SPRING = "cubic-bezier(0.34, 1.45, 0.5, 1)";
const SLOW_IN = "cubic-bezier(0.25, 0.8, 0.35, 1)";
const SNAP = "cubic-bezier(0.1, 1.5, 0.4, 1)";

export type Actor = {
  /** 0 = Caption A, 1 = Caption B. */
  i: 0 | 1;
  /** +1 faces right (A), -1 faces left (B). */
  dir: 1 | -1;
  el: HTMLElement; // .kf (positioned)
  rig: HTMLElement; // .kf-rig (body-level transforms)
  body: HTMLElement; // .kf-body (mirror + spin)
  head: HTMLElement; // .kf-head
  /** Where the rig currently is, so each move starts from where the last one ended. */
  s: { x: number; y: number; r: number; sx: number; sy: number };
};

export type Fx = {
  burst(x: number, y: number): void;
  sparks(x: number, y: number, n?: number, colors?: string[], stars?: boolean): void;
  puff(x: number, y: number, dx?: number): void;
  lines(x: number, y: number, flip?: boolean): void;
  word(x: number, y: number, text: string): void;
  flash(): void;
  shake(size: "s" | "m"): void;
};

export type Ctx = {
  winner: Actor;
  loser: Actor;
  /** px per em of a fighter. */
  u: number;
  /** stage size in px. */
  w: number;
  h: number;
  /** stage-relative y of the fighters' feet. */
  floorY: number;
  fx: Fx;
  wait(ms: number): Promise<void>;
  pose(a: Actor, p: Pose, ms?: number, ease?: string): void;
  move(a: Actor, to: Partial<Actor["s"]>, ms: number, easing?: string): Promise<void>;
  fly(a: Actor, path: Array<Partial<Actor["s"]> & { at: number }>, ms: number, easing?: string): Promise<void>;
  spin(a: Actor, ms: number): Promise<void>;
  headAnim(a: Actor, frames: Keyframe[], ms: number, easing?: string): Promise<void>;
  headPoint(a: Actor): { x: number; y: number };
  say(text: string, kind: "ko" | "small" | "finish" | "win"): void;
  ref(mood: "idle" | "curious" | "inspired" | "proud" | "thinking" | "confused", jolt?: boolean): void;
  prop(a: Actor, on: boolean): void;
  dizzy(a: Actor, on: boolean): void;
  hide(a: Actor): void;
  down(a: Actor): void;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const cx = (a: Actor, u: number) => a.el.offsetLeft + 7 * u + a.s.x;

/** Contact distance (centre to centre, in ems) when the attacker's fist/foot lands. */
const REACH = { uppercut: 18.2, roundhouse: 16.6, bonk: 17.2 } as const;

async function approach(c: Ctx, move: MoveName) {
  const { winner: W, loser: L, u } = c;
  const gap = Math.abs(L.el.offsetLeft - W.el.offsetLeft);
  return Math.max(0, gap - REACH[move] * u) * W.dir;
}

// ------------------------------------------------------------------ UPPERCUT
async function uppercut(c: Ctx) {
  const { winner: W, loser: L, u } = c;
  const d = W.dir;
  c.ref("curious");
  c.pose(L, POSE.brace, 260);

  // Anticipation: sink low, wind the fist back. Slow in, a beat of tension.
  c.pose(W, POSE.upWind, 380, SLOW_IN);
  await c.move(W, { x: -0.9 * u * d, y: 0.8 * u, sx: 1.07, sy: 0.88, r: -4 * d }, 380, SLOW_IN);
  await c.wait(150);

  // Lunge: a quick stretched slide in, fist still low.
  const dash = await approach(c, "uppercut");
  c.pose(W, { ...POSE.upWind, tr: -4, lf1: -50, lf2: 56, lb1: 34, lb2: -50 }, 120);
  await c.move(W, { x: dash, y: 0.4 * u, sx: 1.12, sy: 0.9, r: 4 * d }, 230, "cubic-bezier(0.3, 0.7, 0.3, 1)");

  // The strike: leap and drive the fist up through the opponent's chin.
  c.pose(W, POSE.upHit, 95, SNAP);
  void c.move(W, { x: dash + 0.7 * u * d, y: -2.3 * u, sx: 0.92, sy: 1.14, r: 8 * d }, 130, "cubic-bezier(0.2, 0.9, 0.3, 1)");
  await c.wait(95);

  // Impact.
  const hp = c.headPoint(L);
  c.fx.flash();
  c.fx.burst(hp.x - d * 2 * u, hp.y + 3.4 * u);
  c.fx.sparks(hp.x - d * 2 * u, hp.y + 3.4 * u, 12, undefined, true);
  c.fx.lines(hp.x, hp.y + 3 * u, d < 0);
  c.fx.shake("m");
  c.say("K.O.!", "ko");
  c.ref("curious", true);
  c.pose(W, POSE.upTop, 120, SNAP);

  // The loser's head snaps back, then the whole fighter is launched, spinning,
  // up and out of the arena.
  void c.headAnim(L, [{ transform: "scaleX(var(--m)) rotate(0deg)" }, { transform: `scaleX(var(--m)) rotate(${-38 * d}deg) scale(1.1, 0.88)` }, { transform: `scaleX(var(--m)) rotate(${-12 * d}deg)` }], 320);
  c.pose(L, POSE.hurt, 100, SNAP);
  window.setTimeout(() => c.pose(L, POSE.flail, 160), 120 * 1);
  window.setTimeout(() => c.pose(L, POSE.hurt, 160), 330);
  window.setTimeout(() => c.pose(L, POSE.flail, 160), 560);
  const out = c.fly(
    L,
    [
      { at: 0 },
      { at: 0.1, x: L.s.x + 2.4 * u * d, y: -1.2 * u, r: -22 * d, sx: 1.08, sy: 0.92 },
      { at: 0.55, x: L.s.x + 9 * u * d, y: -(c.floorY * 0.78), r: 380 * d, sx: 1, sy: 1 },
      { at: 1, x: L.s.x + 15 * u * d, y: -(c.floorY + 18 * u), r: 880 * d, sx: 0.55, sy: 0.55 },
    ],
    1250,
    "cubic-bezier(0.2, 0.62, 0.4, 1)",
  );

  // Aftermath: the winner floats back down and lands in a cartoon puff.
  await c.wait(180);
  await c.move(W, { y: 0, sx: 1.12, sy: 0.86, r: 0 }, 360, "cubic-bezier(0.5, 0, 0.9, 0.5)");
  const foot = { x: cx(W, u), y: c.floorY };
  c.fx.puff(foot.x - 2.4 * u, foot.y);
  c.fx.puff(foot.x + 2.4 * u, foot.y, 12);
  c.fx.shake("s");
  c.pose(W, POSE.victory, 240, SPRING);
  await c.move(W, { sx: 1, sy: 1 }, 260, SPRING);
  await out;
  c.hide(L);
  c.ref("proud");
  await c.move(W, { y: -1.8 * u }, 170, "ease-out");
  await c.move(W, { y: 0, sx: 1.06, sy: 0.94 }, 170, "ease-in");
  c.pose(W, POSE.victory2, 160, SPRING);
  await c.move(W, { y: -1.4 * u, sx: 0.97, sy: 1.04 }, 150, "ease-out");
  await c.move(W, { y: 0, sx: 1, sy: 1 }, 150, "ease-in");
}

// ---------------------------------------------------------------- ROUNDHOUSE
async function roundhouse(c: Ctx) {
  const { winner: W, loser: L, u } = c;
  const d = W.dir;
  c.ref("thinking");
  c.pose(L, POSE.brace, 260);

  // Anticipation: coil away from the target, weight on the back foot.
  c.pose(W, POSE.rWind, 420, SLOW_IN);
  await c.move(W, { x: -1.6 * u * d, y: 0.5 * u, sx: 1.04, sy: 0.92, r: -9 * d }, 420, SLOW_IN);
  await c.wait(130);

  // The spin: a hop-turn across the arena. The body flips through edge-on (a full
  // turn), the head stays put so the photo stays readable.
  const dash = await approach(c, "roundhouse");
  c.ref("curious");
  c.pose(W, { ...POSE.rWind, tr: -8, b1: -120, b2: -60, f1: -120, f2: -60 }, 140);
  void c.spin(W, 440);
  void c.headAnim(W, [{ transform: "scaleX(var(--m)) rotate(0deg)" }, { transform: `scaleX(var(--m)) rotate(${d * 22}deg)` }, { transform: "scaleX(var(--m)) rotate(0deg)" }], 440);
  c.pose(W, POSE.rKick, 130, SNAP);
  window.setTimeout(() => c.pose(W, POSE.rKick, 90, SNAP), 300);
  await c.move(W, { x: dash, y: -2.2 * u, sx: 1, sy: 1, r: 14 * d }, 440, "cubic-bezier(0.35, 0, 0.35, 1)");

  // The kick lands.
  const hp = c.headPoint(L);
  c.fx.flash();
  c.fx.burst(hp.x - d * 3 * u, hp.y + 2 * u);
  c.fx.sparks(hp.x - d * 3 * u, hp.y + 2 * u, 14, undefined, true);
  c.fx.lines(hp.x, hp.y + 1.5 * u, d < 0);
  c.fx.shake("m");
  c.say("ABSOLUTE DESTRUCTION!", "small");
  c.ref("curious", true);
  void c.headAnim(L, [{ transform: "scaleX(var(--m)) rotate(0deg)" }, { transform: `scaleX(var(--m)) rotate(${d * 52}deg) scale(1.12, 0.86)` }, { transform: `scaleX(var(--m)) rotate(${d * 20}deg)` }], 360);
  c.pose(L, POSE.hurt, 90, SNAP);
  window.setTimeout(() => c.pose(L, POSE.flail, 160), 160);
  window.setTimeout(() => c.pose(L, POSE.hurt, 160), 420);
  window.setTimeout(() => c.pose(L, POSE.flail, 160), 700);

  // The loser rockets sideways across the arena and out of frame.
  const span = c.w + 14 * u;
  const out = c.fly(
    L,
    [
      { at: 0 },
      { at: 0.06, x: L.s.x + d * 1.6 * u, y: -0.8 * u, r: d * 18, sx: 1.1, sy: 0.9 },
      { at: 0.5, x: L.s.x + d * span * 0.62, y: -4.2 * u, r: d * 430, sx: 1, sy: 1 },
      { at: 1, x: L.s.x + d * span, y: -1.2 * u, r: d * 900, sx: 0.8, sy: 0.8 },
    ],
    1050,
    "cubic-bezier(0.3, 0.55, 0.55, 1)",
  );

  // The winner holds the pose a beat, then lands and takes a bow.
  await c.wait(420);
  c.pose(W, { ...POSE.rKick, lf1: -60, lf2: 40 }, 200, "ease-out");
  await c.move(W, { y: 0, r: 0, sx: 1.1, sy: 0.88 }, 280, "cubic-bezier(0.5, 0, 0.9, 0.5)");
  c.fx.puff(cx(W, u) - 2.2 * u, c.floorY);
  c.fx.puff(cx(W, u) + 2.6 * u, c.floorY, 12);
  c.fx.shake("s");
  c.pose(W, POSE.victory, 240, SPRING);
  await c.move(W, { sx: 1, sy: 1 }, 260, SPRING);
  await out;
  c.hide(L);
  c.ref("proud");
  await c.move(W, { y: -1.8 * u }, 170, "ease-out");
  await c.move(W, { y: 0, sx: 1.06, sy: 0.94 }, 170, "ease-in");
  c.pose(W, POSE.victory2, 160, SPRING);
  await c.move(W, { y: -1.4 * u, sx: 0.97, sy: 1.04 }, 150, "ease-out");
  await c.move(W, { y: 0, sx: 1, sy: 1 }, 150, "ease-in");
}

// --------------------------------------------------------------------- BONK
async function bonk(c: Ctx) {
  const { winner: W, loser: L, u } = c;
  const d = W.dir;

  // A comically oversized mallet appears out of nowhere.
  c.pose(W, POSE.reach, 240, SPRING);
  c.prop(W, true);
  const hand = (() => {
    const r = W.el.getBoundingClientRect();
    const s = W.el.parentElement!.getBoundingClientRect();
    return { x: r.left - s.left + (d > 0 ? 11.2 : 2.8) * u, y: r.top - s.top + 17 * u };
  })();
  c.fx.puff(hand.x, hand.y);
  c.fx.sparks(hand.x, hand.y, 8, ["#ffe27a", "#fff"], true);
  c.ref("curious", true);
  c.pose(L, POSE.scared, 200);
  void c.move(L, { y: 4 * u, sy: 0.88, sx: 1.04 }, 260, "ease-out");
  await c.wait(200);
  void c.headAnim(L, [{ transform: "scaleX(var(--m)) rotate(-9deg)" }, { transform: "scaleX(var(--m)) rotate(9deg)" }, { transform: "scaleX(var(--m)) rotate(-9deg)" }, { transform: "scaleX(var(--m)) rotate(9deg)" }, { transform: "scaleX(var(--m)) rotate(0deg)" }], 520);
  const lhp = c.headPoint(L);
  c.fx.word(lhp.x, lhp.y - 6 * u, "?!");
  await c.wait(260);

  // Anticipation: hammer high overhead, leaning back, quivering with effort.
  c.pose(W, POSE.bonkUp, 460, SLOW_IN);
  await c.move(W, { x: -1.1 * u * d, y: 0.5 * u, sx: 1.05, sy: 0.92, r: -7 * d }, 460, SLOW_IN);
  for (let i = 0; i < 2; i++) {
    await c.move(W, { x: -1.1 * u * d + 0.28 * u, r: -7 * d + 1.2 }, 55, "linear");
    await c.move(W, { x: -1.1 * u * d - 0.28 * u, r: -7 * d - 1.2 }, 55, "linear");
  }
  c.ref("thinking");
  await c.wait(90);

  // Two big bounds toward the target.
  const dash = await approach(c, "bonk");
  await c.move(W, { x: dash * 0.5, y: -2.6 * u, sx: 0.96, sy: 1.06, r: -2 * d }, 230, "cubic-bezier(0.3, 0.7, 0.4, 1)");
  await c.move(W, { x: dash * 0.5 + 0.6 * u * d, y: 0, sx: 1.1, sy: 0.9 }, 150, "ease-in");
  await c.wait(60);
  void c.move(W, { x: dash, y: -3 * u, sx: 0.94, sy: 1.1, r: 2 * d }, 260, "cubic-bezier(0.3, 0.7, 0.4, 1)");
  await c.wait(180);

  // THE BONK.
  c.pose(W, POSE.bonkSwing, 110, SNAP);
  await c.wait(95);
  const hp = c.headPoint(L);
  c.fx.flash();
  c.fx.burst(hp.x, hp.y - 4 * u);
  c.fx.sparks(hp.x, hp.y - 4 * u, 14, undefined, true);
  c.fx.word(hp.x, hp.y - 9 * u, "BONK!");
  c.fx.shake("m");
  c.say("K.O.!", "ko");
  c.ref("confused", true);
  void c.headAnim(L, [{ transform: "scaleX(var(--m)) scale(1, 1)" }, { transform: "scaleX(var(--m)) scale(1.34, 0.5)" }, { transform: "scaleX(var(--m)) scale(1.24, 0.58)" }], 140);
  void c.move(L, { sx: 1.16, sy: 0.64, y: 0 }, 110, "ease-out");
  c.pose(L, POSE.squashed, 110, SNAP);
  c.dizzy(L, true);
  await c.move(W, { y: -1.4 * u, sx: 1.04, sy: 0.96 }, 120, "ease-out");
  await c.wait(380); // comedy: the long squashed beat

  // Boing: the squished fighter springs back, then tumbles away across the arena.
  c.fx.sparks(hp.x, hp.y - 2 * u, 8, ["#ffd23f"], true);
  void c.headAnim(L, [{ transform: "scaleX(var(--m)) scale(1.24, 0.58)" }, { transform: "scaleX(var(--m)) scale(0.82, 1.28)" }, { transform: "scaleX(var(--m)) scale(1, 1)" }], 240);
  c.pose(L, POSE.flail, 140);
  c.dizzy(L, false);
  c.prop(W, false);
  c.fx.puff(cx(W, u) + d * 5 * u, c.floorY - 14 * u);
  const span = c.w + 14 * u;
  const out = c.fly(
    L,
    [
      { at: 0, sx: 1.16, sy: 0.64 },
      { at: 0.1, y: -1 * u, sx: 0.84, sy: 1.3, r: d * 14 },
      { at: 0.3, x: L.s.x + d * span * 0.26, y: -7 * u, r: d * 300, sx: 1, sy: 1 },
      { at: 0.46, x: L.s.x + d * span * 0.4, y: 0, r: d * 470, sx: 1.12, sy: 0.88 },
      { at: 0.68, x: L.s.x + d * span * 0.62, y: -4 * u, r: d * 760, sx: 1, sy: 1 },
      { at: 0.82, x: L.s.x + d * span * 0.78, y: 0, r: d * 960, sx: 1.08, sy: 0.92 },
      { at: 1, x: L.s.x + d * span, y: -2 * u, r: d * 1260, sx: 0.8, sy: 0.8 },
    ],
    1180,
    "linear",
  );
  window.setTimeout(() => c.pose(L, POSE.hurt, 150), 300);
  window.setTimeout(() => c.pose(L, POSE.flail, 150), 580);

  // The winner lands and gives the mallet a victorious twirl.
  await c.move(W, { y: 0, sx: 1.1, sy: 0.88 }, 220, "cubic-bezier(0.5, 0, 0.9, 0.5)");
  c.fx.puff(cx(W, u) - 2.4 * u, c.floorY);
  c.fx.puff(cx(W, u) + 2.6 * u, c.floorY, 12);
  c.fx.shake("s");
  c.pose(W, POSE.victory, 240, SPRING);
  await c.move(W, { sx: 1, sy: 1 }, 240, SPRING);
  await out;
  c.hide(L);
  c.ref("proud");
  await c.move(W, { y: -1.8 * u }, 170, "ease-out");
  await c.move(W, { y: 0, sx: 1.06, sy: 0.94 }, 170, "ease-in");
  c.pose(W, POSE.victory2, 160, SPRING);
  await c.move(W, { y: -1.4 * u, sx: 0.97, sy: 1.04 }, 150, "ease-out");
  await c.move(W, { y: 0, sx: 1, sy: 1 }, 150, "ease-in");
}

export async function runMove(name: MoveName, c: Ctx) {
  if (name === "uppercut") return uppercut(c);
  if (name === "roundhouse") return roundhouse(c);
  return bonk(c);
}

export { rad };
