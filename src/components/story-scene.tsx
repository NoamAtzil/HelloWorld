"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Creature } from "./creature";
import { Icon } from "./icons";
import { REST_INDEX, STORY, nextIndex, phaseOf, type StoryId } from "@/lib/story";

// Three original illustrations the creature "finds" in the loop. They are brand
// artwork, not AI output; real results appear in the gallery and workspace.
function Photo({ kind }: { kind: number }) {
  const id = `ph${kind}`;
  if (kind === 1) {
    return (
      <svg viewBox="0 0 200 250" className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a beach with an umbrella">
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fc7e8" /><stop offset="1" stopColor="#ffe6c4" /></linearGradient>
          <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f9bbd" /><stop offset="1" stopColor="#8fd3d6" /></linearGradient>
        </defs>
        <rect width="200" height="250" fill={`url(#${id}s)`} />
        <circle cx="150" cy="58" r="22" fill="#fff4d2" />
        <rect y="118" width="200" height="50" fill={`url(#${id}w)`} />
        <path d="M0 168Q60 150 120 166T200 160V250H0Z" fill="#f4cf94" />
        <path d="M0 200Q70 184 140 200T200 196V250H0Z" fill="#e9b877" />
        <rect x="98" y="148" width="3.4" height="62" rx="1.7" fill="#7a4a24" />
        <path d="M64 150Q100 108 136 150Z" fill="#ee6a24" />
        <path d="M80 140Q100 112 120 140Q110 148 100 142Q90 148 80 140Z" fill="#fff3df" />
        <ellipse cx="146" cy="214" rx="26" ry="7" fill="#c24a10" opacity=".9" />
      </svg>
    );
  }
  if (kind === 2) {
    return (
      <svg viewBox="0 0 200 250" className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of mountains over a lake">
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9d86b8" /><stop offset=".6" stopColor="#f2a98a" /><stop offset="1" stopColor="#ffd9a8" /></linearGradient>
          <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98f86" /><stop offset="1" stopColor="#6e5a7d" /></linearGradient>
        </defs>
        <rect width="200" height="250" fill={`url(#${id}s)`} />
        <circle cx="62" cy="86" r="17" fill="#fff0cf" opacity=".95" />
        <path d="M0 150L48 96L86 138L128 82L200 150V160H0Z" fill="#7b638f" />
        <path d="M0 160L40 124L78 154L120 112L200 160V170H0Z" fill="#5a4a72" />
        <rect y="160" width="200" height="90" fill={`url(#${id}l)`} />
        <path d="M0 176H200M0 194H200M0 214H200" stroke="#fff0cf" strokeOpacity=".25" strokeWidth="1.4" />
        <path d="M96 196q18 8 38 0l-5 8q-14 5-28 0Z" fill="#3d2f4f" /><path d="M115 172V196" stroke="#3d2f4f" strokeWidth="2" /><path d="M115 174l14 18h-14Z" fill="#ffe4b8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 250" className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a sunset over hills">
      <defs><linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9ad" /><stop offset=".55" stopColor="#ffb070" /><stop offset="1" stopColor="#ff8a4c" /></linearGradient></defs>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <circle cx="140" cy="86" r="30" fill="#fff3d6" opacity=".96" />
      <path d="M0 160Q50 114 102 150T200 138V250H0Z" fill="#c2560f" opacity=".88" />
      <path d="M0 202Q64 160 124 190T200 182V250H0Z" fill="#8f3a0a" />
      <path d="M34 70q7-9 14 0 7-9 14 0M70 46q5-7 10 0 5-7 10 0" stroke="#7a3208" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// A real result photo (a short-lived signed URL, so not optimizable by next/image).
function RealPhoto({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

const SAMPLES = [
  { kind: 0, caption: "Caught between a nap and a masterpiece." },
  { kind: 1, caption: "Sunscreen: applied. Dignity: optional." },
  { kind: 2, caption: "He said five minutes. The lake said otherwise." },
];

const subscribeMotion = (cb: () => void) => {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The hero story. The Caption Creature notices a photo drifting out from behind
 * a frosted pane, studies it, thinks, has an idea, and produces a caption card.
 * CSS (studio.css) does the choreography from `data-step`; this component only
 * advances the steps. With reduced motion, or off-screen, it holds the finished
 * frame, which is a complete picture on its own.
 */
export function StoryScene({
  photoUrl,
  caption,
  slots: givenSlots,
  className = "",
  forceStep,
}: {
  photoUrl?: string | null;
  caption?: string | null;
  /** HelloWorld: the photos (and sample captions) the creature finds, in order. */
  slots?: { imageUrl: string; caption: string }[];
  className?: string;
  /** Hold one step of the story (controlled mode, used for visual QA). */
  forceStep?: StoryId;
}) {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tabShown, setTabShown] = useState(true);
  const reduced = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  const playing = !forceStep && !reduced && visible && tabShown;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const onVis = () => setTabShown(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      const n = nextIndex(idx);
      if (n === 0) setCycle((c) => c + 1);
      setIdx(n);
    }, STORY[idx].ms);
    return () => clearTimeout(id);
  }, [playing, idx]);

  // Cursor depth + gaze, written straight to CSS variables (no re-render).
  function onPointerMove(e: React.PointerEvent) {
    if (reduced || e.pointerType === "touch") return;
    const el = root.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height - 0.5) * 2));
      el.style.setProperty("--mx", nx.toFixed(3));
      el.style.setProperty("--my", ny.toFixed(3));
      el.style.setProperty("--cgx", nx.toFixed(3));
      el.style.setProperty("--cgy", ny.toFixed(3));
    });
  }
  function onPointerLeave() {
    const el = root.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    for (const v of ["--mx", "--my", "--cgx", "--cgy"]) el.style.setProperty(v, "0");
  }

  const forced = forceStep ? STORY.findIndex((st) => st.id === forceStep) : -1;
  const shown = forced >= 0 ? forced : playing ? idx : REST_INDEX;
  const step = STORY[shown];
  const slots: { kind: number; caption: string; url?: string }[] = givenSlots?.length
    ? givenSlots.map((g) => ({ kind: -1, caption: g.caption, url: g.imageUrl }))
    : photoUrl || caption
      ? [{ kind: -1, caption: caption ?? SAMPLES[0].caption, url: photoUrl ?? undefined }, ...SAMPLES.slice(1)]
      : SAMPLES;
  const slot = slots[(playing ? cycle : 0) % slots.length];

  return (
    <div
      ref={root}
      className={`scene ${className}`}
      data-step={step.id}
      data-phase={phaseOf(step.id)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label={`Illustration: a small orange creature studies a photo, has an idea, and writes a caption for it.${caption ? ` The latest caption: ${caption}` : ""}`}
    >
      <div className="sc-layer sc-back">
        <div className="sc-bloom" />
      </div>

      <div className="sc-layer sc-mid">
        <div className="sc-photo">
          <div className="sc-print">
            <div>{slot.url ? <RealPhoto src={slot.url} /> : <Photo kind={slot.kind === -1 ? 0 : slot.kind} />}</div>
          </div>
        </div>

        <div className="sc-creature">
          <div className="cr-hop">
            <Creature mood={step.mood} />
          </div>
          <div className="sc-bubble liquid" aria-hidden="true">
            <i /><i /><i />
          </div>
        </div>

        <div className="sc-card">
          <div className="sc-caption">
            <p className="eyebrow flex items-center gap-[0.6cqw]"><Icon name="quote" className="h-[1em] w-[1em]" /> Final caption</p>
            <p className="caption-text">{slot.caption}</p>
          </div>
        </div>
      </div>

      <div className="sc-layer sc-front" aria-hidden="true">
        <div className="sc-mullion liquid" />
        <div className="sc-ledge liquid">
          <div className="sc-legend">
            <span data-k="spot"><b>1</b> Spot it</span>
            <span data-k="think"><b>2</b> Think</span>
            <span data-k="caption"><b>3</b> Caption</span>
          </div>
        </div>
      </div>
    </div>
  );
}
