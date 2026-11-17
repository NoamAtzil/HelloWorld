// A tiny confetti system: one fixed canvas, a few hundred particles at most, no
// library. Used for the submission ceremony, vote applause and the winner reveal.
// It does nothing for people who prefer reduced motion.

export const CONFETTI_GOLD = ["#f7c948", "#ffe08a", "#d9a21b", "#fff3c4", "#ffb347", "#ffffff"];
export const CONFETTI_PARTY = ["#ff7a1a", "#ffb15a", "#ffe08a", "#5b6cff", "#ff5a7a", "#2ec4a6", "#ffffff"];

type Shape = "rect" | "star" | "dot";
type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; color: string; life: number; ttl: number; shape: Shape };

export type ConfettiOpts = {
  /** viewport pixels */
  x: number;
  y: number;
  count?: number;
  /** direction in degrees: -90 = straight up */
  angle?: number;
  /** total spread in degrees */
  spread?: number;
  /** initial speed in px/s */
  speed?: number;
  gravity?: number;
  colors?: string[];
  ttl?: number;
  shapes?: Shape[];
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let parts: P[] = [];
let raf = 0;
let last = 0;
const MAX = 320;

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawStar(c: CanvasRenderingContext2D, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    c[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  c.closePath();
  c.fill();
}

function tick(now: number) {
  if (!canvas || !ctx) return;
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const next: P[] = [];
  for (const p of parts) {
    p.life += dt;
    if (p.life >= p.ttl || p.y > window.innerHeight + 40) continue;
    p.vy += 900 * dt * 0.6 * (p as P & { g?: number }).g!;
    p.vx *= 0.992;
    p.vy *= 0.992;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += p.vr * dt;
    const fade = p.life > p.ttl - 0.5 ? Math.max(0, (p.ttl - p.life) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.fillStyle = p.color;
    if (p.shape === "rect") ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 6 + p.r)));
    else if (p.shape === "dot") {
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else drawStar(ctx, p.w * 0.8);
    ctx.restore();
    next.push(p);
  }
  parts = next;
  if (parts.length) raf = requestAnimationFrame(tick);
  else stopConfetti();
}

export function fireConfetti(o: ConfettiOpts) {
  if (typeof document === "undefined" || reduced()) return;
  ensureCanvas();
  const count = Math.min(o.count ?? 70, MAX - parts.length);
  const angle = ((o.angle ?? -90) * Math.PI) / 180;
  const spread = ((o.spread ?? 70) * Math.PI) / 180;
  const colors = o.colors ?? CONFETTI_PARTY;
  const shapes = o.shapes ?? ["rect", "rect", "dot", "star"];
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const sp = (o.speed ?? 760) * (0.45 + Math.random() * 0.65);
    const size = 6 + Math.random() * 7;
    const p: P & { g?: number } = {
      x: o.x,
      y: o.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 14,
      w: size,
      h: size * (0.5 + Math.random() * 0.6),
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      ttl: (o.ttl ?? 2.6) * (0.7 + Math.random() * 0.5),
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      g: o.gravity ?? 1,
    };
    parts.push(p);
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

/** Remove everything now (Skip, navigation). */
export function stopConfetti() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  parts = [];
  if (canvas) {
    window.removeEventListener("resize", resize);
    canvas.remove();
  }
  canvas = null;
  ctx = null;
}
