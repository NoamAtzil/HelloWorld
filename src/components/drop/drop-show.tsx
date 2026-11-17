"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Guide } from "@/components/guide";
import { Icon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { DROP_INTRO_KEY } from "@/lib/drop";
import { dropGuidance } from "@/lib/guidance";
import { getAudio } from "@/lib/sound/engine";
import { useSound } from "@/lib/sound/use-sound";
import { Countdown } from "./countdown";

type Curtain = "closed" | "opening" | "open";

const noSubscribe = () => () => {};
// Should the curtain play? Once a day per device, never with reduced motion. Read through
// useSyncExternalStore so the server and the first client render agree (no hydration mismatch).
function wantsIntro(today: string, enabled: boolean): boolean {
  if (!enabled) return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return window.localStorage.getItem(DROP_INTRO_KEY) !== today;
  } catch {
    return false;
  }
}

// THE DAILY DROP SHOW: today's photo is the star. A velvet curtain opens (once a
// day per device, skippable, never for people who prefer reduced motion), a
// spotlight finds the photo, the host introduces the night, and a live countdown
// runs to the reset at midnight Eastern.
export function DropShow({
  dateLabel,
  today,
  challenge,
  signedIn,
  alreadyEntered,
  entryCount,
}: {
  dateLabel: string;
  today: string;
  challenge: { title: string; theme: string | null; photoUrl: string } | null;
  signedIn: boolean;
  alreadyEntered: boolean;
  entryCount: number | null;
}) {
  const router = useRouter();
  const sound = useSound("drop");
  const audio = getAudio();
  const wants = useSyncExternalStore(noSubscribe, () => wantsIntro(today, Boolean(challenge)), () => false);
  const [stage, setStage] = useState<"pending" | Curtain>("pending");
  const curtain: Curtain = stage === "pending" ? (wants ? "closed" : "open") : stage;
  const handled = useRef(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const rememberSeen = () => {
    try {
      window.localStorage.setItem(DROP_INTRO_KEY, today);
    } catch {
      /* ignore */
    }
  };

  function raise() {
    clear();
    rememberSeen();
    setStage("opening");
    audio.play("d_curtain", { gain: 0.9 });
    at(600, () => audio.play("d_sting", { gain: 0.8 }));
    at(2100, () => setStage("open"));
  }

  async function raiseFromTap() {
    // A tap is the gesture that lets the browser play sound.
    if (sound.on) {
      audio.unlock("drop");
      await audio.load("drop");
    }
    raise();
  }

  function skip() {
    clear();
    rememberSeen();
    audio.stopAll(0.05);
    setStage("open");
  }

  // The first visit of the day: the curtains are already closed (derived above, plus a
  // pre-paint script on a hard load so there is no flash); open them, or wait for a tap
  // if the browser hasn't allowed sound yet.
  useEffect(() => {
    if (handled.current || !sound.known) return;
    handled.current = true;
    document.documentElement.removeAttribute("data-drop-intro");
    if (!wants) return;
    at(0, () => {
      setStage("closed");
      const locked = sound.on && audio.supported && !audio.running;
      if (!locked) at(750, raise);
    });
    return () => clear();
    // Runs once, when the sound preference is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.known]);

  const guidance = dropGuidance({ signedIn, hasChallenge: Boolean(challenge), alreadyEntered, entries: entryCount, curtain });
  const showing = curtain !== "open";

  return (
    <section className="show" data-curtain={curtain} aria-labelledby="show-title">
      <div className="show-valance" aria-hidden="true" />
      <div className="show-bulbs" aria-hidden="true" />

      <div className="show-grid">
        <div className="show-copy">
          <p className="show-eyebrow">{dateLabel}</p>
          <h1 id="show-title" className="show-title">
            The Daily <em>Drop</em> Show
          </h1>
          <ul className="show-motto" aria-label="One photo. One caption. One day.">
            <li>One photo.</li>
            <li>One caption.</li>
            <li>One day.</li>
          </ul>

          <div className="show-clock" role="timer" aria-label="Time until the Daily Drop resets at midnight Eastern Time">
            <span className="dot" aria-hidden="true" />
            <span>
              <small>Curtain falls in</small>
              <b>
                <Countdown onReset={() => router.refresh()} />
              </b>
            </span>
            <small className="hidden sm:block">midnight
              <br />
              Eastern</small>
          </div>
          {challenge?.theme && <p className="text-sm text-ink-2">Tonight&apos;s theme: <span className="font-semibold text-accent-text">{challenge.theme}</span></p>}

          <Guide guidance={guidance} eyebrow="Your host" size="md" />

          <div className="flex flex-wrap items-center gap-2">
            {!challenge ? null : !signedIn ? (
              <Link href="/login?next=/drop" className="btn-primary btn-lg press">
                Sign in to play
              </Link>
            ) : alreadyEntered ? (
              <a href="#entries" className="btn-primary btn-lg press">
                Judge the entries <Icon name="arrow" />
              </a>
            ) : (
              <a href="#studio" className="btn-primary btn-lg press">
                <Icon name="spark" /> Enter tonight&apos;s show
              </a>
            )}
            {sound.supported && (
              <button
                type="button"
                className="show-btn"
                aria-pressed={sound.on}
                onClick={() => void sound.toggle()}
                title={sound.on && !sound.ready ? "Sound is on. Tap anywhere to start it." : "Curtain, stamp, applause and fanfare sounds. Off until you turn it on."}
              >
                <Icon name={sound.on ? "volume" : "mute"} className="h-3.5 w-3.5" /> Sound: {sound.on ? "on" : "off"}
              </button>
            )}
          </div>
        </div>

        <div className="show-stage">
          <div className="show-spot" aria-hidden="true" />
          {challenge ? (
            <>
              <div className="show-frame">
                <Photo src={challenge.photoUrl} alt={challenge.title} size="drop" loading="eager" scrim={false} />
              </div>
              <p className="show-plaque">{challenge.title}</p>
            </>
          ) : (
            <div className="show-frame">
              <p className="grid min-h-48 place-items-center px-6 text-center font-display text-lg text-[#3d2606]">The stage is dark tonight. Check back tomorrow.</p>
            </div>
          )}
        </div>
      </div>

      <div className="show-curtain l" aria-hidden="true" />
      <div className="show-curtain r" aria-hidden="true" />
      <div className="show-plate">
        <p className="show-eyebrow !text-[#f3d38a]">{dateLabel}</p>
        <p className="show-title">
          The Daily <em className="!text-[#ffd98a]">Drop</em> Show
        </p>
        <p>One photo. One caption. One day.</p>
        {curtain === "closed" && (
          <button type="button" onClick={() => void raiseFromTap()} autoFocus className="btn-primary btn-lg press">
            Raise the curtain
          </button>
        )}
      </div>
      {showing && (
        <button type="button" onClick={skip} className="show-skip btn-quiet btn-sm" aria-label="Skip the intro">
          Skip <Icon name="arrow" className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  );
}
