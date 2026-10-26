"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { voiceLabel } from "@/lib/voices";
import { castDuelVote, nextPair } from "./actions";
import type { ArenaPair, ArenaReveal, ArenaSide } from "./pair";

type Phase =
  | { name: "judging" }
  | { name: "saving"; picked: number }
  | { name: "revealed"; picked: number; reveal: ArenaReveal };

export function ArenaClient({ initialPair, loadFailed }: { initialPair: ArenaPair | null; loadFailed: boolean }) {
  const [pair, setPair] = useState<ArenaPair | null>(initialPair);
  const [phase, setPhase] = useState<Phase>({ name: "judging" });
  const [error, setError] = useState<string | null>(loadFailed ? "Couldn't load a battle. Refresh to try again." : null);
  const [judged, setJudged] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  async function vote(winner: ArenaSide, loser: ArenaSide) {
    if (phase.name !== "judging") return;
    setError(null);
    setPhase({ name: "saving", picked: winner.id });
    try {
      const result = await castDuelVote(winner.id, loser.id);
      if (!result.ok) {
        setError(result.error);
        setPhase({ name: "judging" });
        return;
      }
      setPhase({ name: "revealed", picked: winner.id, reveal: result.reveal });
      setJudged((n) => n + 1);
      setTimeout(() => nextRef.current?.focus(), 50);
    } catch {
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
      setPair(result.pair);
      setPhase({ name: "judging" });
    } catch {
      setError("We couldn't reach the server. Try again.");
    } finally {
      setLoadingNext(false);
    }
  }

  if (!pair) {
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center">
        <p className="font-display text-xl font-bold">
          {judged > 0 ? "You've judged every battle available." : "No battles to judge yet."}
        </p>
        <p className="max-w-sm text-sm text-muted">
          Battles need captions from other people. Publish a few of your own and check back as the
          community grows, or enter today&apos;s Daily Drop.
        </p>
        {error && <p role="alert" className="text-sm text-coral-text">{error}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/studio" className="btn-primary press">Make a caption</Link>
          <Link href="/drop" className="btn-quiet press">Today&apos;s Drop</Link>
        </div>
      </div>
    );
  }

  const revealed = phase.name === "revealed" ? phase : null;
  const sides = [pair.left, pair.right];

  return (
    <div className="flex flex-col gap-5">
      {pair.sameImage && sides[0].imageUrl && (
        <div className="relative overflow-hidden rounded-[22px] bg-tint-2 shadow-card ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sides[0].imageUrl} alt="The photo both captions are about" className="max-h-[26rem] w-full object-cover" />
        </div>
      )}

      <div role="group" aria-label="Choose the funnier caption" className="grid gap-4 sm:grid-cols-2">
        {sides.map((side, index) => {
          const other = sides[1 - index];
          const picked = phase.name !== "judging" && phase.picked === side.id;
          const lost = phase.name !== "judging" && !picked;
          const info = revealed ? (revealed.reveal.winner.id === side.id ? revealed.reveal.winner : revealed.reveal.loser) : null;
          return (
            <div key={side.id} className="flex flex-col gap-2">
              {!pair.sameImage && side.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={side.imageUrl} alt="" className="aspect-[4/3] w-full rounded-[18px] object-cover ring-1 ring-black/5" />
              )}
              <button
                type="button"
                onClick={() => void vote(side, other)}
                disabled={phase.name !== "judging"}
                aria-label={`Vote for caption ${index + 1}: ${side.content}`}
                className={`arena-plate bend-plate plate-glass press relative px-5 pb-7 pt-5 pr-12 text-left ${
                  picked ? "is-winner" : ""
                } ${lost ? "is-loser" : ""}`}
              >
                <span aria-hidden="true" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-accent-text">
                  Caption {index === 0 ? "A" : "B"}
                </span>
                <span className="block text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{side.content}</span>
                {picked && (
                  <span className="arena-badge" aria-hidden="true">
                    {revealed ? "Your pick" : "…"}
                  </span>
                )}
              </button>
              {info && (
                <p className="arena-reveal px-2 text-sm text-muted" style={{ "--i": index } as React.CSSProperties}>
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

      {revealed && (
        <div className="arena-reveal glass flex flex-col gap-3 rounded-2xl p-4" role="status">
          <CrowdBar reveal={revealed.reveal} />
          <button ref={nextRef} type="button" onClick={() => void another()} disabled={loadingNext} className="btn-primary press self-start">
            {loadingNext ? "Loading…" : "Next battle"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text">{error}</p>}
      {phase.name === "judging" && (
        <p className="text-sm text-muted">
          {judged > 0 ? `${judged} judged this session. ` : ""}Pick the funnier one. Authors are revealed after you vote.
        </p>
      )}
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
        {only
          ? "You're the first to judge this pair."
          : `${pct}% of ${total} judges agreed with your pick.`}
      </p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="arena-fill h-full rounded-full bg-glow" style={{ width: `${only ? 100 : pct}%` }} />
      </div>
    </div>
  );
}
