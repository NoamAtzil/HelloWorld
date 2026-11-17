"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { arenaGuidance, crowdVerdict, type Guidance } from "@/lib/guidance";
import { voiceLabel } from "@/lib/voices";
import { castDuelVote, nextPair } from "./actions";
import { pickMove, type MoveName } from "./kombat/choreo";
import { FightStage, type Rect } from "./kombat/fight-stage";
import type { ArenaPair, ArenaReveal, ArenaSide } from "./pair";

// CAPTION KOMBAT. The voting itself (castDuelVote / nextPair and every rule
// behind them) is exactly as before. Around it: a short VS intro, then, only
// after the server confirms a vote, a purely theatrical showdown in which the
// two photos become fighters and the picked caption's fighter wins. The real
// community result is always shown afterwards, and the fight never changes it.

type Phase =
  | { name: "intro" }
  | { name: "judging" }
  | { name: "saving"; picked: number }
  | { name: "fight"; picked: number; reveal: ArenaReveal; move: MoveName }
  | { name: "revealed"; picked: number; reveal: ArenaReveal };

type Ann = { text: string; kind: "ready" | "battle"; n: number };

const PREF_KEY = "wss-fights";

export function ArenaClient({ initialPair, loadFailed }: { initialPair: ArenaPair | null; loadFailed: boolean }) {
  const [pair, setPair] = useState<ArenaPair | null>(initialPair);
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [error, setError] = useState<string | null>(loadFailed ? "Couldn't load a battle. Refresh to try again." : null);
  const [judged, setJudged] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const [ann, setAnn] = useState<Ann | null>(null);
  // null until we've read the preference (and prefers-reduced-motion) on the client
  const [animOn, setAnimOn] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [k, setK] = useState(1);
  const nextRef = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const photos = useRef<Array<HTMLElement | null>>([null, null]);
  const shared = useRef<HTMLElement | null>(null);
  const timers = useRef<number[]>([]);
  const introsPlayed = useRef(0);
  const fightsPlayed = useRef(0);
  const lastMove = useRef<MoveName | null>(null);
  const annN = useRef(0);
  // Synchronous guard: a double-click can never send two votes for one battle.
  const voting = useRef(false);

  // ---- preferences --------------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      setReduced(mq.matches);
      let off = false;
      try {
        off = window.localStorage.getItem(PREF_KEY) === "off";
      } catch {
        /* storage unavailable: default on */
      }
      setAnimOn(!mq.matches && !off);
    };
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  function toggleAnim() {
    const next = !animOn;
    setAnimOn(next);
    try {
      window.localStorage.setItem(PREF_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!next) skipAnimation();
  }

  // ---- intro: darken, cards enter, VS, GET READY! / BATTLE! ---------------
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const say = (text: string, kind: Ann["kind"]) => setAnn({ text, kind, n: ++annN.current });

  const endIntro = useCallback(() => {
    clearTimers();
    setAnn(null);
    introsPlayed.current += 1;
    setPhase((p) => (p.name === "intro" ? { name: "judging" } : p));
  }, []);

  const pairKey = pair ? `${pair.left.id}-${pair.right.id}` : "none";
  useEffect(() => {
    if (animOn === null || !pair) return;
    const first = introsPlayed.current === 0;
    const speed = first ? 1 : 0.55;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms * speed));
    if (!animOn) {
      at(0, endIntro);
    } else if (first) {
      at(650, () => say("GET READY!", "ready"));
      at(1300, () => say("BATTLE!", "battle"));
      at(1950, endIntro);
    } else {
      at(260, () => say("BATTLE!", "battle"));
      at(1000, endIntro);
    }
    return clearTimers;
    // The intro belongs to a matchup appearing; it is keyed on the pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey, animOn]);

  function skipAnimation() {
    if (phase.name === "intro") endIntro();
    else if (phase.name === "fight") setPhase({ name: "revealed", picked: phase.picked, reveal: phase.reveal });
  }

  // ---- voting (unchanged rules) -------------------------------------------
  async function vote(winner: ArenaSide, loser: ArenaSide) {
    if (phase.name !== "judging" || voting.current) return;
    voting.current = true;
    setError(null);
    setPhase({ name: "saving", picked: winner.id });
    try {
      const result = await castDuelVote(winner.id, loser.id);
      if (!result.ok) {
        voting.current = false;
        setError(result.error);
        setPhase({ name: "judging" });
        return;
      }
      setJudged((n) => n + 1);
      // Only a server-confirmed vote can start the showdown.
      if (animOn && !reduced) {
        const move = pickMove(lastMove.current);
        lastMove.current = move;
        setK(fightsPlayed.current === 0 ? 0.9 : 0.66);
        fightsPlayed.current += 1;
        setPhase({ name: "fight", picked: winner.id, reveal: result.reveal, move });
      } else {
        setPhase({ name: "revealed", picked: winner.id, reveal: result.reveal });
      }
    } catch {
      voting.current = false;
      setError("We couldn't reach the server. Try again.");
      setPhase({ name: "judging" });
    }
  }

  async function another() {
    setLoadingNext(true);
    setError(null);
    try {
      const result = await nextPair();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      voting.current = false;
      setPair(result.pair);
      setK(0.55);
      setPhase({ name: "intro" });
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setLoadingNext(false);
    }
  }

  const revealed = phase.name === "revealed" ? phase : null;
  const fighting = phase.name === "fight" ? phase : null;

  // Focus "Next battle" once the result is on screen (keyboard users).
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => nextRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [revealed]);

  // Where the VS badge sits: on the photos' seam, measured so it works for any layout.
  useLayoutEffect(() => {
    const f = field.current;
    if (!f || !pair) return;
    const place = () => {
      const fr = f.getBoundingClientRect();
      const sh = shared.current;
      let y = 0;
      if (sh) {
        y = sh.getBoundingClientRect().bottom - fr.top;
      } else {
        const p = photos.current[0];
        if (p) {
          const r = p.getBoundingClientRect();
          y = r.top - fr.top + r.height / 2;
        }
      }
      f.style.setProperty("--vs-y", `${y}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(f);
    return () => ro.disconnect();
  }, [pair, pairKey]);

  const fromRects = useCallback((): [Rect, Rect] | null => {
    const f = field.current;
    if (!f) return null;
    const fr = f.getBoundingClientRect();
    const rect = (el: HTMLElement | null): Rect | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - fr.left, top: r.top - fr.top, width: r.width, height: r.height };
    };
    if (shared.current) {
      const r = rect(shared.current);
      return r ? [r, r] : null;
    }
    const a = rect(photos.current[0]);
    const b = rect(photos.current[1]);
    return a && b ? [a, b] : null;
  }, []);

  // The Caption Creature's reaction is derived from the real state.
  let guidance: Guidance;
  if (!pair) guidance = arenaGuidance(error ? { phase: "failed" } : { phase: "empty" });
  else if (revealed) guidance = arenaGuidance({ phase: "revealed", pairTotal: revealed.reveal.pair_total, pairWinnerVotes: revealed.reveal.pair_winner_votes });
  else if (fighting) guidance = arenaGuidance({ phase: "fight" });
  else if (phase.name === "saving") guidance = { mood: "thinking", title: "Counting your vote", line: "One moment…" };
  else if (error) guidance = { mood: "confused", title: "That didn't count", line: "Hm. That didn't go to plan. Try again." };
  else if (phase.name === "intro") guidance = arenaGuidance({ phase: "intro" });
  else guidance = arenaGuidance({ phase: "ready" });

  if (!pair) {
    return (
      <div className="stage">
        <div className="stage-beam" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 p-6 sm:p-10">
          <Guide guidance={guidance} eyebrow="The Arena" size="lg" as="h1" />
          <p className="max-w-lg text-ink-2">
            {judged > 0 ? "You've judged every battle available. " : ""}Battles need captions from other people. Publish a few of your own and check back as the community grows, or enter today&apos;s Daily Drop.
          </p>
          {error && <p role="alert" className="text-sm font-medium text-coral-text">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/studio" className="btn-primary press">
              <Icon name="spark" /> Make a caption
            </Link>
            <Link href="/drop" className="btn-quiet press">
              <Icon name="calendar" /> Today&apos;s Drop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sides = [pair.left, pair.right];
  const sharedPhoto = pair.sameImage ? sides[0].imageUrl : null;
  const animating = phase.name === "intro" || phase.name === "fight";
  const pickedIndex = revealed ? (sides[0].id === revealed.picked ? 0 : 1) : fighting ? (sides[0].id === fighting.picked ? 0 : 1) : -1;
  const verdict = revealed ? crowdVerdict(revealed.reveal.pair_total, revealed.reveal.pair_winner_votes) : null;

  return (
    <div className="stage">
      <div className="stage-beam" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 p-4 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Guide guidance={guidance} eyebrow="Caption Kombat" as="h1" />
          {animOn !== null && !reduced && (
            <button
              type="button"
              onClick={toggleAnim}
              aria-pressed={animOn}
              className="btn-ghost btn-sm shrink-0"
              title="Turn the fight animations on or off"
            >
              <Icon name="duel" className="h-3.5 w-3.5" /> Fights: {animOn ? "on" : "off"}
            </button>
          )}
        </div>

        <div ref={field} className="kb-field" data-phase={phase.name} style={{ "--k": k } as React.CSSProperties}>
          <div className="kb-grid" role="group" aria-label="Choose the funnier caption">
            {sharedPhoto && (
              <div
                ref={(el) => {
                  shared.current = el;
                }}
                className="kb-photo kb-photo-shared"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sharedPhoto} alt="The photo both captions are about" loading="eager" decoding="async" />
              </div>
            )}
            {sides.map((side, index) => {
              const other = sides[1 - index];
              const picked = (phase.name === "saving" || phase.name === "fight" || phase.name === "revealed") && phase.picked === side.id;
              const lost = (phase.name === "saving" || phase.name === "fight" || phase.name === "revealed") && !picked;
              const info = revealed ? (revealed.reveal.winner.id === side.id ? revealed.reveal.winner : revealed.reveal.loser) : null;
              return (
                <div key={side.id} className="kb-card" data-side={index}>
                  {!sharedPhoto && side.imageUrl && (
                    <div
                      ref={(el) => {
                        photos.current[index] = el;
                      }}
                      className="kb-photo"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={side.imageUrl} alt="" loading="eager" decoding="async" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void vote(side, other)}
                    disabled={phase.name !== "judging"}
                    aria-label={`Vote for caption ${index + 1}: ${side.content}`}
                    className={`kb-plate arena-plate liquid liquid-strong press relative rounded-2xl px-4 pb-6 pt-4 text-left sm:px-5 sm:pt-5 ${picked ? "is-winner" : ""} ${lost ? "is-loser" : ""}`}
                  >
                    <span aria-hidden="true" className="eyebrow mb-2 block">
                      Caption {index === 0 ? "A" : "B"}
                    </span>
                    <span className="caption-text block">{side.content}</span>
                    {picked && (
                      <span className="arena-badge" aria-hidden="true">
                        {revealed || fighting ? "Your pick" : "…"}
                      </span>
                    )}
                  </button>
                  {info && (
                    <p className="arena-reveal px-1 text-sm text-muted" style={{ "--i": index } as React.CSSProperties}>
                      <span className="font-semibold text-ink">{info.author}</span>
                      {voiceLabel(info.voice) ? ` · ${voiceLabel(info.voice)}` : ""}
                      <span className="block text-xs">
                        {info.wins} {info.wins === 1 ? "win" : "wins"} in {info.battles} {info.battles === 1 ? "battle" : "battles"}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="kb-vs" aria-hidden="true">
            <span>VS</span>
          </div>
          <div className="kb-dim" aria-hidden="true" />
          <div className="kb-beam l" aria-hidden="true" />
          <div className="kb-beam r" aria-hidden="true" />
          {ann && phase.name === "intro" && (
            <div key={ann.n} className="kb-ann" data-kind={ann.kind} data-text={ann.text} aria-hidden="true">
              {ann.text}
            </div>
          )}

          {fighting && (
            <FightStage
              key={`${pairKey}-${fighting.picked}`}
              heads={[sides[0].imageUrl, sides[1].imageUrl]}
              captions={[sides[0].content, sides[1].content]}
              winner={pickedIndex === 1 ? 1 : 0}
              move={fighting.move}
              k={k}
              from={fromRects}
              onDone={() => setPhase((p) => (p.name === "fight" ? { name: "revealed", picked: p.picked, reveal: p.reveal } : p))}
            />
          )}

          {animating && (
            <button type="button" onClick={skipAnimation} className="kb-skip btn-quiet btn-sm" aria-label="Skip the animation">
              Skip <Icon name="arrow" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {revealed && verdict && (
          <div className="arena-reveal panel flex flex-col gap-3 p-4 sm:p-5" role="status">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="kb-wins">Your pick wins!</span>
              <span className="text-xs text-muted">The showdown is just for show. The real result is below.</span>
            </div>
            <div>
              <p className="eyebrow">{verdict.label}</p>
              <CrowdBar reveal={revealed.reveal} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button ref={nextRef} type="button" onClick={() => void another()} disabled={loadingNext} className="btn-primary btn-lg press">
                {loadingNext ? (
                  <>
                    <span className="spinner" /> Loading…
                  </>
                ) : (
                  <>
                    Next battle <Icon name="arrow" />
                  </>
                )}
              </button>
              <span className="text-sm text-muted">Ready for your next battle?</span>
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">{error}</p>}
        {phase.name === "judging" && (
          <p className="text-sm text-muted">
            {judged > 0 ? `${judged} judged this session. ` : ""}Pick the funnier one. Authors are revealed after you vote.
          </p>
        )}
      </div>
    </div>
  );
}

function CrowdBar({ reveal }: { reveal: ArenaReveal }) {
  const total = reveal.pair_total;
  const pct = total === 0 ? 0 : Math.round((reveal.pair_winner_votes / total) * 100);
  const only = total === 1;
  return (
    <div>
      <p className="text-sm font-medium">
        {only ? "You're the first to judge this pair." : `${pct}% of ${total} judges agreed with your pick.`}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-tint-2" aria-hidden="true">
        <div className="arena-fill h-full rounded-full bg-gradient-to-r from-glow to-amber" style={{ width: `${only ? 100 : pct}%` }} />
      </div>
    </div>
  );
}
