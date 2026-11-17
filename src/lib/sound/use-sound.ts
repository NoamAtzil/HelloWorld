"use client";

import { useCallback, useEffect, useState } from "react";
import { getAudio, SOUND_PREF_KEY, type SoundGroup } from "./engine";

// The sound preference: ON by default for every feature with audio, and remembered
// once someone turns it off. The browser only lets audio start after a gesture, so
// "on" is unlocked by the first tap, click or keypress on the page (the Arena's
// PRESS START and the Daily Drop's "Raise the curtain" are exactly that tap).
export function useSound(group: SoundGroup) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [known, setKnown] = useState(false);

  useEffect(() => {
    const audio = getAudio();
    let pref = true; // on unless the person has explicitly turned it off
    try {
      pref = window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
    } catch {
      /* storage unavailable: use the default (on) */
    }
    const sync = () => setReady(audio.isReady(group));
    const off = audio.subscribe(sync);
    // Microtask: these are external-system reads, not render-driven state.
    queueMicrotask(() => {
      setSupported(audio.supported);
      audio.setEnabled(pref && audio.supported);
      setOn(pref && audio.supported);
      sync();
      setKnown(true);
      // Already unlocked earlier this visit (e.g. on another page): just fetch this page's sounds.
      if (pref && audio.running) void audio.load(group);
    });
    return () => {
      off();
    };
  }, [group]);

  // A remembered "on" still needs one gesture before the browser allows sound.
  useEffect(() => {
    if (!on) return;
    const audio = getAudio();
    const unlock = () => audio.unlock(group);
    const events = ["click", "touchend", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, unlock, { capture: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock, { capture: true }));
  }, [on, group]);

  // Never leave sound running when the tab is hidden or the page is left.
  useEffect(() => {
    const audio = getAudio();
    const hide = () => {
      if (document.hidden) audio.stopAll(0.05);
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", () => audio.stopAll(0.02));
    return () => {
      document.removeEventListener("visibilitychange", hide);
      audio.stopAll(0.05);
    };
  }, []);

  /**
   * Call from a click handler: turning sound on is the user gesture that unlocks
   * audio. Resolves true once sound is on, unlocked and decoded (false when turned off).
   */
  const toggle = useCallback(async (): Promise<boolean> => {
    const audio = getAudio();
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    audio.setEnabled(next);
    if (!next) return false;
    audio.unlock(group);
    await audio.load(group);
    audio.play("ui_on");
    return audio.isReady(group);
  }, [on, group]);

  return { supported, on, ready, known, toggle };
}
