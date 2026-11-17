// CAPTION KOMBAT audio. Web Audio, no libraries.
//
// Mix: announcer (voice bus) prominent, effects (sfx bus) a little under it,
// music (music bus) barely there. Everything feeds one compressor and a soft
// clipper, so stacked sounds can never produce a harsh peak.
//
// Safety rules baked in:
//  - On by default (the preference is persisted once someone turns it off), but
//    nothing plays until a user gesture lets the browser start audio.
//  - Nothing is created, downloaded or played before a user gesture permits it (Safari/iOS):
//    unlock() runs inside a click/touch handler.
//  - One announcer line at a time (a new line fades the old one out).
//  - stopAll() clears every live source (Skip, mute, navigation, unmount).
//  - Assets are small AAC files decoded once, so effects start instantly.

export type SoundName =
  | "h_masterpiece" | "h_shimmer" | "h_spot" | "h_tap" | "h_pip"
  | "d_curtain" | "d_sting" | "d_stamp" | "d_drop" | "d_applause" | "d_vote" | "d_drumroll" | "d_fanfare" | "d_chime" | "d_pop"
  | "ui_on" | "whoosh_in" | "vs_hit" | "sting" | "morph" | "windup" | "punch" | "whoosh_up"
  | "launch" | "spin" | "kick" | "fly_away" | "poof" | "hammer_swing" | "bonk" | "boing"
  | "land" | "fanfare" | "crowd" | "twinkle" | "ko_hit" | "ring" | "music" | "riser" | "fight_boom"
  | "v_get_ready" | "v_fight" | "v_finish_him" | "v_ko" | "v_wins" | "v_next" | "v_destruction";

// Two groups, loaded separately: Arena visitors never download the Daily Drop sounds, and vice versa.
export type SoundGroup = "arena" | "drop" | "hall";
export const SOUND_GROUPS: Record<SoundGroup, SoundName[]> = {
  arena: [
    "ui_on", "whoosh_in", "vs_hit", "sting", "morph", "windup", "punch", "whoosh_up", "launch", "spin", "kick",
    "fly_away", "poof", "hammer_swing", "bonk", "boing", "land", "fanfare", "crowd", "twinkle", "ko_hit", "ring",
    "music", "riser", "fight_boom", "v_get_ready", "v_fight", "v_finish_him", "v_ko", "v_wins", "v_next", "v_destruction",
  ],
  hall: ["ui_on", "h_masterpiece", "h_shimmer", "h_spot", "h_tap", "h_pip"],
  drop: ["ui_on", "d_curtain", "d_sting", "d_stamp", "d_drop", "d_applause", "d_vote", "d_drumroll", "d_fanfare", "d_chime", "d_pop"],
};
export const SOUND_NAMES: SoundName[] = [...new Set([...SOUND_GROUPS.arena, ...SOUND_GROUPS.drop])];

const BASE = "/audio/arena/";
type Bus = "voice" | "sfx" | "music";
// How long each announcer line is actually spoken (the file also holds a reverb tail,
// which may ring under the next line; only speech is never talked over).
const SPEECH_SECONDS: Partial<Record<SoundName, number>> = {
  v_get_ready: 2.8, h_masterpiece: 3.9, v_fight: 1.4, v_finish_him: 1.7, v_ko: 1.35, v_wins: 1.75, v_next: 1.65, v_destruction: 1.95,
};
// Announcer prominent, effects a little quieter, music subtle.
const BUS_GAIN: Record<Bus, number> = { voice: 1.0, sfx: 0.52, music: 0.11 };

type Live = { src: AudioBufferSourceNode; gain: GainNode; bus: Bus; name: SoundName; end: number };
export type PlayOpts = { gain?: number; rate?: number; pan?: number; bus?: Bus; delay?: number; loop?: boolean };

type LogEntry = { t: number; name: string; bus: Bus; gain: number; rate: number; delay: number; kind: "play" | "stop" | "voice-cut" };
declare global {
  interface Window {
    __WSS_AUDIO_LOG?: LogEntry[];
    __WSS_AUDIO_TAP?: boolean;
    __wssPeak?: () => number;
    webkitAudioContext?: typeof AudioContext;
  }
}

class ArenaAudio {
  private ctx: AudioContext | null = null;
  private buses = {} as Record<Bus, GainNode>;
  private buffers = new Map<SoundName, AudioBuffer>();
  private loading = new Map<SoundGroup, Promise<void>>();
  private loaded = new Set<SoundGroup>();
  private live = new Set<Live>();
  private voice: Live | null = null;
  private musicLive: Live | null = null;
  private analyser: AnalyserNode | null = null;
  enabled = false;
  private listeners = new Set<() => void>();

  get supported() {
    return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
  }
  get running() {
    return this.ctx?.state === "running";
  }
  /** Sound can play right now: enabled, unlocked by a gesture, and this group is decoded. */
  isReady(group: SoundGroup) {
    return this.enabled && this.running && this.loaded.has(group);
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll(0.04);
    this.emit();
  }

  /** Must be called synchronously inside a user gesture (click, touchend, keydown). */
  unlock(group: SoundGroup) {
    if (!this.supported || !this.enabled) return;
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    if (ctx.state === "suspended") void ctx.resume().then(() => this.emit());
    // iOS: a silent one-sample play inside the gesture fully unlocks output.
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
    void this.load(group);
  }

  private build() {
    const Ctor = window.AudioContext || window.webkitAudioContext!;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const clip = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15);
    }
    clip.curve = curve;
    clip.oversample = "2x";
    master.connect(comp);
    comp.connect(clip);
    clip.connect(ctx.destination);
    (["voice", "sfx", "music"] as Bus[]).forEach((b) => {
      const g = ctx.createGain();
      g.gain.value = BUS_GAIN[b];
      g.connect(master);
      this.buses[b] = g;
    });
    if (window.__WSS_AUDIO_TAP) {
      (window as unknown as { __wssAudio: ArenaAudio }).__wssAudio = this;
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      clip.connect(an);
      this.analyser = an;
      let peak = 0;
      const buf = new Float32Array(an.fftSize);
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        requestAnimationFrame(tick);
      };
      tick();
      window.__wssPeak = () => peak;
    }
  }

  /** Fetch + decode every asset of a group once. Safe to call repeatedly. */
  load(group: SoundGroup): Promise<void> {
    const existing = this.loading.get(group);
    if (existing) return existing;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    const p = Promise.all(
      SOUND_GROUPS[group].map(async (name) => {
        if (this.buffers.has(name)) return;
        try {
          const res = await fetch(`${BASE}${name}.m4a`);
          if (!res.ok) return;
          const data = await res.arrayBuffer();
          // Promise + callback form together: works on older Safari too.
          const buf = await new Promise<AudioBuffer>((resolve, reject) => {
            const pr = ctx.decodeAudioData(data, resolve, reject);
            if (pr && typeof pr.then === "function") pr.then(resolve, reject);
          });
          this.buffers.set(name, buf);
        } catch {
          /* a missing or undecodable asset just stays silent */
        }
      }),
    ).then(() => {
      this.loaded.add(group);
      this.emit();
    });
    this.loading.set(group, p);
    return p;
  }

  private log(e: Omit<LogEntry, "t">) {
    if (typeof window !== "undefined" && window.__WSS_AUDIO_LOG) window.__WSS_AUDIO_LOG.push({ t: performance.now(), ...e });
  }

  duration(name: SoundName) {
    return this.buffers.get(name)?.duration ?? 0;
  }

  play(name: SoundName, o: PlayOpts = {}): Live | null {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.running) return null;
    const buf = this.buffers.get(name);
    if (!buf) return null;
    const bus = o.bus ?? (name.startsWith("v_") ? "voice" : name === "music" ? "music" : "sfx");
    const rate = o.rate ?? 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = !!o.loop;
    const gain = ctx.createGain();
    gain.gain.value = o.gain ?? 1;
    src.connect(gain);
    let out: AudioNode = gain;
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      gain.connect(p);
      out = p;
    }
    out.connect(this.buses[bus]);
    const start = ctx.currentTime + (o.delay ?? 0);
    const speech = SPEECH_SECONDS[name];
    const live: Live = { src, gain, bus, name, end: start + (speech ?? buf.duration) / rate };
    this.live.add(live);
    src.onended = () => {
      this.live.delete(live);
      try {
        src.disconnect();
        gain.disconnect();
        out.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.start(start);
    this.log({ name, bus, gain: o.gain ?? 1, rate, delay: o.delay ?? 0, kind: "play" });
    return live;
  }

  /** The announcer: one line at a time. A new line fades the previous one out. */
  say(name: SoundName) {
    if (this.voice && this.ctx && this.voice.end > this.ctx.currentTime + 0.05) {
      this.log({ name: this.voice.name, bus: "voice", gain: 0, rate: 1, delay: 0, kind: "voice-cut" });
      this.fadeStop(this.voice, 0.06);
    }
    this.voice = this.play(name, { bus: "voice" });
  }

  /** Seconds of announcer speech still to come (0 if silent). */
  voiceRemaining() {
    if (!this.ctx || !this.voice) return 0;
    return Math.max(0, this.voice.end - this.ctx.currentTime);
  }

  startMusic(fadeIn = 0.5) {
    if (this.musicLive || !this.ctx) return;
    const l = this.play("music", { loop: true, gain: 0.0001 });
    if (!l) return;
    l.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    l.gain.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + fadeIn);
    this.musicLive = l;
  }
  stopMusic(fadeOut = 0.6) {
    if (this.musicLive) this.fadeStop(this.musicLive, fadeOut);
    this.musicLive = null;
  }

  private fadeStop(l: Live, sec: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      l.gain.gain.cancelScheduledValues(t);
      l.gain.gain.setValueAtTime(Math.max(l.gain.gain.value, 0.0001), t);
      l.gain.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      l.src.stop(t + sec + 0.02);
    } catch {
      /* already stopped */
    }
  }

  /** Stop everything now (Skip, mute, navigation, unmount). */
  stopAll(fade = 0.05) {
    this.live.forEach((l) => this.fadeStop(l, fade));
    this.voice = null;
    this.musicLive = null;
    this.log({ name: "*", bus: "sfx", gain: 0, rate: 1, delay: 0, kind: "stop" });
  }

  get liveCount() {
    return this.live.size;
  }
}

let instance: ArenaAudio | null = null;
export function getAudio(): ArenaAudio {
  if (!instance) instance = new ArenaAudio();
  return instance;
}
export type { ArenaAudio };

export const SOUND_PREF_KEY = "wss-sound";
