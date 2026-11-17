#!/usr/bin/env python3
"""
Builds the Caption Kombat audio (public/audio/arena/*.m4a) from scratch.

  * Sound effects and the music loop are synthesised here (numpy/scipy): noise
    sweeps, resonant bodies, bells, saws and so on. Nothing is sampled from any
    game or recording.
  * The announcer lines are rendered with the macOS built-in speech synthesiser
    (`say`, voice "Ralph") and then heavily processed (pitch, doubling, grit,
    slapback, reverb). The result is generated audio, not a recording. NOTE:
    the underlying voice is Apple's; if this ever ships commercially, re-render
    the lines with a TTS whose licence you have confirmed.

Run:  python3 scripts/audio/make-arena-audio.py
Needs: macOS (say, afconvert), python3 with numpy and scipy. Deterministic.
"""
import os, subprocess, sys, tempfile
import numpy as np
import scipy.io.wavfile as wf
import scipy.signal as ss

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "audio", "arena")
rng = np.random.default_rng(20261116)

# ----------------------------------------------------------------- primitives
def T(sec): return np.arange(int(round(sec * SR))) / SR
def noise(sec): return rng.standard_normal(int(round(sec * SR)))
def peak_norm(x, peak): return x / (np.max(np.abs(x)) + 1e-9) * peak
def lp(x, f, o=4): return ss.sosfilt(ss.butter(o, min(f, SR / 2 - 100) / (SR / 2), "low", output="sos"), x)
def hp(x, f, o=4): return ss.sosfilt(ss.butter(o, f / (SR / 2), "high", output="sos"), x)
def bp(x, lo, hi, o=2): return ss.sosfilt(ss.butter(o, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band", output="sos"), x)
def fade(x, a=0.004, b=0.02):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x
def pad(x, sec): return np.concatenate([x, np.zeros(max(0, int(sec * SR) - len(x)))])[: int(sec * SR)]
def place(buf, x, at, gain=1.0):
    i = int(at * SR); j = min(len(buf), i + len(x))
    if i < len(buf): buf[i:j] += x[: j - i] * gain
def sat(x, drive): return np.tanh(drive * x) / np.tanh(drive)
def reverb(x, rt=0.8, wet=0.25, damp=5500):
    n = int(rt * SR * 1.4); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / rt); ir = lp(ir, damp, 2); ir[0] = 0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = ss.fftconvolve(x, ir)[: len(x) + n // 2]
    out = np.concatenate([x, np.zeros(len(w) - len(x))]) * (1 - wet * 0.5) + w * wet * 1.6
    return out
def echo(x, delay=0.09, gain=0.22):
    d = int(delay * SR); y = np.concatenate([x, np.zeros(d)]); y[d:] += x * gain; return y
def sweep_noise(sec, f0, f1, q=2.2, curve="exp", block=256):
    n = int(round(sec * SR)); x = rng.standard_normal(n); out = np.zeros(n); zi = None
    nb = n // block + 1
    for b in range(nb):
        u = b / max(1, nb - 1)
        f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
        bw = f / q
        lo, hi = max(40, f - bw / 2), min(SR / 2 - 200, f + bw / 2)
        sos = ss.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos")
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        i, j = b * block, min(n, (b + 1) * block)
        if i >= n: break
        out[i:j], zi = ss.sosfilt(sos, x[i:j], zi=zi)
    return out / (np.std(out) + 1e-9)
def tone(f0, f1, sec, curve="exp"):
    t = T(sec); u = t / sec
    f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def tone_f(f_arr):
    return np.sin(2 * np.pi * np.cumsum(f_arr) / SR)
def saws(freq, sec, detunes=(-7, 7)):
    t = T(sec); y = np.zeros_like(t)
    for c in detunes:
        f = freq * 2 ** (c / 1200); y += ss.sawtooth(2 * np.pi * f * t)
    return y / len(detunes)
def bell(f, sec=0.8, decay=7.0, partials=((1, 1.0), (2.76, 0.45), (5.4, 0.22), (8.9, 0.1))):
    t = T(sec); y = np.zeros_like(t)
    for ratio, amp in partials: y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * decay * (0.7 + 0.5 * ratio ** 0.5))
    return y
def filt_env_saw(freq_list, sec, c0, c1, c2, t_peak=0.12, detunes=(-8, 8)):
    """A brass-ish stab: summed saws through a low-pass whose cutoff sweeps c0->c1->c2."""
    y = sum(saws(f, sec, detunes) for f in freq_list) / len(freq_list)
    n = len(y); out = np.zeros(n); zi = None; block = 256
    for b in range(n // block + 1):
        i, j = b * block, min(n, (b + 1) * block)
        if i >= n: break
        t = i / SR
        cut = c0 + (c1 - c0) * (t / t_peak) if t < t_peak else c1 + (c2 - c1) * min(1, (t - t_peak) / (sec - t_peak))
        sos = ss.butter(2, min(cut, SR / 2 - 200) / (SR / 2), "low", output="sos")
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        out[i:j], zi = ss.sosfilt(sos, y[i:j], zi=zi)
    return out

# ----------------------------------------------------------------- the sounds
S = {}

def ui_on():
    y = np.zeros(int(0.6 * SR)); place(y, bell(659.3, 0.55, 8), 0, 0.8); place(y, bell(987.8, 0.5, 9), 0.09, 0.9); return peak_norm(y, 0.8)
S["ui_on"] = ui_on

def whoosh_in():
    x = sweep_noise(0.55, 240, 3400, q=1.5); t = T(0.55)
    env = np.sin(np.pi * np.clip(t / 0.55, 0, 1) ** 0.8) ** 1.6
    low = tone(70, 150, 0.55) * 0.25 * env
    return peak_norm(fade(hp(x * env + low, 90)), 0.85)
S["whoosh_in"] = whoosh_in

def vs_hit():
    n = 1.3; t = T(n)
    boom = tone(96, 31, n) * np.exp(-t / 0.36)
    thud = lp(noise(n), 700) * np.exp(-t / 0.1) * 0.9
    click = hp(noise(n), 2500) * np.exp(-t / 0.012) * 0.6
    ring = bell(430, n, 4.2, ((1, 1), (2.32, .6), (3.8, .4), (5.1, .25))) * 0.3
    y = boom * 1.1 + thud + click + ring
    y = reverb(sat(y, 1.6), rt=0.9, wet=0.28)
    return peak_norm(fade(y, 0.001, 0.05), 0.92)
S["vs_hit"] = vs_hit

def sting():
    n = 1.25; t = T(n)
    chord = [110.0, 164.81, 220.0, 261.63, 329.63]
    st = filt_env_saw(chord, n, 500, 4600, 1200, 0.1)
    env = np.minimum(t / 0.012, 1) * np.where(t < 0.3, 1, np.exp(-(t - 0.3) / 0.35))
    cym = hp(noise(n), 5200) * np.exp(-t / 0.45) * 0.22
    sub = tone(55, 50, n) * np.exp(-t / 0.4) * 0.7
    y = st * env + cym + sub
    y = reverb(sat(y, 1.8), rt=0.9, wet=0.25)
    return peak_norm(fade(y, 0.002, 0.08), 0.9)
S["sting"] = sting

def morph():
    n = 0.85; t = T(n)
    f = 190 + 520 * (1 - np.exp(-t / 0.16)) + 28 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.35)
    a = tone_f(f) * np.exp(-t / 0.38) * np.minimum(t / 0.02, 1)
    y = a * 0.9 + 0.25 * hp(sweep_noise(n, 400, 2600, q=1.2), 200) * np.exp(-t / 0.25)
    sp = np.zeros_like(t)
    for k in range(7):
        at = 0.18 + k * 0.075 + rng.random() * 0.02; f0 = rng.choice([2637, 3136, 3951, 4699, 5274])
        place(sp, bell(f0, 0.22, 16, ((1, 1), (2.0, .3))), at, 0.35)
    return peak_norm(fade(reverb(y + sp, 0.5, 0.18), 0.002, 0.05), 0.85)
S["morph"] = morph

def windup():
    n = 0.65; t = T(n); u = t / n
    sw = sweep_noise(n, 180, 2600, q=1.4) * (u ** 2.2)
    sa = lp(saws(1.0, n, (0,)) * 0, 100)  # placeholder (kept zero)
    f = 80 * (3.3 ** u); tn = ss.sawtooth(2 * np.pi * np.cumsum(f) / SR); tn = lp(tn, 900) * (u ** 1.8) * 0.45
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * 21 * t)
    y = (sw * 0.7 + tn) * trem
    return peak_norm(fade(y, 0.01, 0.012), 0.8)
S["windup"] = windup

def punch():
    n = 0.55; t = T(n)
    thump = tone(165, 46, n) * np.exp(-t / 0.085)
    crack = bp(noise(n), 1300, 5600) * np.exp(-t / 0.022) * 0.9
    body = lp(noise(n), 650) * np.exp(-t / 0.07) * 0.7
    y = sat(thump * 1.2 + crack + body, 2.2)
    return peak_norm(fade(reverb(y, 0.35, 0.14), 0.0005, 0.06), 0.93)
S["punch"] = punch

def whoosh_up():
    n = 0.75; t = T(n)
    x = sweep_noise(n, 300, 7200, q=1.8)
    env = (np.clip(t / n, 0, 1) ** 1.4) * np.where(t < n - 0.1, 1, np.clip((n - t) / 0.1, 0, 1))
    th = tone(420, 2300, n) * 0.12 * env
    return peak_norm(fade(hp(x * env + th, 120), 0.01, 0.02), 0.82)
S["whoosh_up"] = whoosh_up

def launch():
    n = 1.1; t = T(n); u = t / n
    f = 520 * (2500 / 520) ** (u ** 0.9) * (1 + 0.025 * np.sin(2 * np.pi * 6.5 * t))
    w = tone_f(f) + 0.3 * tone_f(f * 2); w *= np.exp(-t / 0.7) * np.minimum(t / 0.03, 1)
    sp_f = 130 + 230 * np.exp(-t / 0.05) * np.sin(2 * np.pi * 38 * t) ; sp = tone_f(np.maximum(60, sp_f)) * np.exp(-t / 0.14) * 0.8
    y = w * 0.7 + sp
    return peak_norm(fade(reverb(y, 0.5, 0.15), 0.002, 0.1), 0.82)
S["launch"] = launch

def spin():
    n = 0.6; t = T(n); u = t / n
    cf = 800 + 1500 * np.sin(np.pi * u)
    x = sweep_noise(n, 800, 2300, q=2.0, curve="lin")
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 16 * t)
    env = np.sin(np.pi * u) ** 1.2
    low = tone_f(300 + 220 * np.sin(np.pi * u)) * 0.22
    return peak_norm(fade(hp(x * lfo * env + low * env, 100), 0.01, 0.03), 0.82)
S["spin"] = spin

def kick():
    n = 0.7; t = T(n)
    thump = tone(122, 34, n) * np.exp(-t / 0.13)
    crack = bp(noise(n), 900, 4300) * np.exp(-t / 0.032) * 0.85
    pop = tone(720, 300, n) * np.exp(-t / 0.04) * 0.5
    y = sat(thump * 1.3 + crack + pop, 2.4)
    return peak_norm(fade(reverb(y, 0.45, 0.18), 0.0005, 0.07), 0.94)
S["kick"] = kick

def fly_away():
    n = 1.15; t = T(n)
    x = sweep_noise(n, 3600, 360, q=1.7) * np.exp(-t / 0.55) * np.minimum(t / 0.02, 1)
    w = tone(1900, 320, n) * np.exp(-t / 0.5) * 0.28
    return peak_norm(fade(hp(x + w, 110), 0.003, 0.15), 0.8)
S["fly_away"] = fly_away

def poof():
    n = 0.6; t = T(n)
    x = lp(noise(n), 1900) * np.exp(-t / 0.1)
    y = x * 0.9; y[:int(0.004 * SR)] += 0.8
    sp = np.zeros_like(t)
    for k, f in enumerate([1318.5, 1760, 2349.3]): place(sp, bell(f, 0.3, 11, ((1, 1), (2, .25))), 0.02 + k * 0.05, 0.5)
    return peak_norm(fade(reverb(y + sp, 0.4, 0.15), 0.0005, 0.05), 0.82)
S["poof"] = poof

def hammer_swing():
    n = 0.62; t = T(n)
    x = sweep_noise(n, 450, 2900, q=1.5)
    env = np.where(t < 0.285, (t / 0.285) ** 2.3, np.exp(-(t - 0.285) / 0.02)) * np.minimum(1, (n - t) / 0.02)
    low = tone(130, 62, n) * 0.35 * env
    return peak_norm(fade(hp(x * env + low, 90), 0.01, 0.015), 0.84)
S["hammer_swing"] = hammer_swing

def bonk():
    n = 1.05; t = T(n)
    slap = bp(noise(n), 600, 1200, 2) * np.exp(-t / 0.045) * 1.2
    body = tone(335, 150, n) * np.exp(-t / 0.15)
    body2 = tone(640, 310, n) * np.exp(-t / 0.09) * 0.55
    thump = tone(95, 42, n) * np.exp(-t / 0.12) * 0.8
    wob = 520 * (1 + 0.12 * np.sin(2 * np.pi * 11 * t)) * (1 - 0.2 * t)
    boing = tone_f(wob) * np.exp(-t / 0.4) * np.minimum(np.maximum(t - 0.06, 0) / 0.02, 1) * 0.38
    y = sat(slap + body + body2 + thump + boing, 2.0)
    return peak_norm(fade(reverb(y, 0.4, 0.14), 0.0005, 0.08), 0.94)
S["bonk"] = bonk

def boing():
    n = 0.5; t = T(n)
    f = 330 + 260 * np.sin(2 * np.pi * 17 * t) * np.exp(-t / 0.13) + 120 * np.exp(-t / 0.05)
    y = (tone_f(f) + 0.3 * tone_f(f * 2.0)) * np.exp(-t / 0.16) * np.minimum(t / 0.004, 1)
    return peak_norm(fade(y, 0.001, 0.05), 0.78)
S["boing"] = boing

def land():
    n = 0.45; t = T(n)
    y = tone(92, 44, n) * np.exp(-t / 0.1) + lp(noise(n), 520) * np.exp(-t / 0.08) * 0.8 + hp(noise(n), 2000) * np.exp(-t / 0.02) * 0.2
    return peak_norm(fade(sat(y, 1.6), 0.0005, 0.06), 0.85)
S["land"] = land

def fanfare():
    n = 1.9; y = np.zeros(int(n * SR))
    def brass(freqs, dur, vib=0.0):
        s = filt_env_saw(freqs, dur + 0.05, 600, 3600, 1500, 0.06, (-9, 9))
        t = T(dur + 0.05); e = np.minimum(t / 0.012, 1) * np.where(t < dur - 0.08, 1, np.exp(-(t - (dur - 0.08)) / 0.05))
        if vib: s = s * (1 + vib * np.sin(2 * np.pi * 5.5 * t))
        return s * e
    place(y, brass([392.0, 523.25, 659.25], 0.15), 0.0, 0.8)    # da
    place(y, brass([440.0, 587.33, 698.46], 0.15), 0.17, 0.8)   # da
    place(y, brass([493.88, 659.25, 783.99], 0.15), 0.34, 0.85) # da
    place(y, brass([523.25, 659.25, 783.99, 1046.5, 261.63], 1.1, 0.012), 0.52, 1.0)  # DAAA
    roll = hp(noise(0.5), 1800) * (np.sin(2 * np.pi * 22 * T(0.5)) ** 2) * np.linspace(0.3, 1, int(0.5 * SR)) * 0.35
    place(y, roll, 0.0, 1.0)
    place(y, hp(noise(1.2), 5000) * np.exp(-T(1.2) / 0.5) * 0.3, 0.52, 1.0)
    place(y, tone(65, 52, 0.5) * np.exp(-T(0.5) / 0.3) * 0.8, 0.52, 1.0)
    y = reverb(sat(y, 1.5), rt=1.0, wet=0.28)
    return peak_norm(fade(y, 0.002, 0.15), 0.88)
S["fanfare"] = fanfare

def crowd():
    n = 2.0; t = T(n); y = np.zeros_like(t)
    roar = bp(noise(n), 350, 3800) * (0.7 + 0.3 * lp(noise(n), 6)) * 0.6
    form = bp(noise(n), 650, 900) * 0.5 + bp(noise(n), 1700, 2300) * 0.35
    env = np.minimum(t / 0.22, 1) * np.where(t < 1.1, 1, np.exp(-(t - 1.1) / 0.45))
    y = (roar + form) * env
    claps = np.zeros_like(t)
    for _ in range(55):
        at = 0.1 + rng.random() * 1.5; c = bp(noise(0.06), 900, 3800) * np.exp(-T(0.06) / 0.012)
        place(claps, c, at, 0.5 + 0.5 * rng.random())
    y = y * 0.8 + claps * 0.55
    return peak_norm(fade(reverb(y, 0.7, 0.2), 0.05, 0.3), 0.7)
S["crowd"] = crowd

def twinkle():
    n = 0.55; y = np.zeros(int(n * SR))
    for k, f in enumerate([1760, 2217, 2637, 3520]): place(y, bell(f, 0.3, 13, ((1, 1), (2.0, .25))), k * 0.07, 0.8)
    return peak_norm(fade(reverb(y, 0.4, 0.14), 0.001, 0.08), 0.72)
S["twinkle"] = twinkle

def ko_hit():
    n = 1.6; t = T(n)
    boom = tone(82, 29, n) * np.exp(-t / 0.5)
    crash = hp(noise(n), 1600) * np.exp(-t / 0.33) * 0.55
    metal = bell(700, n, 3.4, ((1, 1), (2.4, .5), (4.1, .35), (6.3, .2))) * 0.35
    thud = lp(noise(n), 600) * np.exp(-t / 0.09) * 0.9
    y = sat(boom * 1.2 + crash + metal + thud, 1.9)
    return peak_norm(fade(reverb(y, 1.0, 0.3), 0.0005, 0.12), 0.93)
S["ko_hit"] = ko_hit

def ring():
    n = 1.5; y = np.zeros(int(n * SR))
    for k in range(3): place(y, bell(1175, 0.9, 5.2, ((1, 1), (2.5, .4), (4.2, .2))), k * 0.27, 0.9 - 0.1 * k)
    return peak_norm(fade(reverb(y, 0.9, 0.22), 0.0005, 0.12), 0.7)
S["ring"] = ring

# ---- music: a subtle 4-bar arcade fight loop, 140 bpm, A minor (i VI III VII)
def music():
    bpm = 140; beat = 60 / bpm; bars = 4; total = bars * 4 * beat
    tail = 1.0; y = np.zeros(int((total + tail) * SR))
    def kickd(): t = T(0.3); return sat(tone(135, 42, 0.3) * np.exp(-t / 0.11) * 1.1, 1.6)
    def snare(): t = T(0.3); return bp(noise(0.3), 1500, 7000) * np.exp(-t / 0.07) * 0.7 + tone(200, 170, 0.3) * np.exp(-t / 0.09) * 0.6
    def hat(acc): t = T(0.08); return hp(noise(0.08), 7500) * np.exp(-t / 0.02) * (0.5 if acc else 0.3)
    roots = [110.0, 87.31, 130.81, 98.0]      # A2 F2 C3 G2
    chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]
    for bar in range(bars):
        b0 = bar * 4 * beat
        for k in (0, 2): place(y, kickd(), b0 + k * beat, 1.0)
        place(y, kickd(), b0 + 3.5 * beat, 0.8)
        for k in (1, 3): place(y, snare(), b0 + k * beat, 0.85)
        for s in range(8): place(y, hat(s % 2 == 0), b0 + s * beat / 2, 1.0)
        root = roots[bar]
        pattern = [1, 1, 1.5, 1, 2, 1, 1.5, 1]  # eighth-note bass riff (ratios)
        for s, r in enumerate(pattern):
            dur = beat / 2 * 0.9; tt = T(dur)
            note = lp(ss.sawtooth(2 * np.pi * root * r * tt), 520) * np.exp(-tt / 0.25) * np.minimum(tt / 0.005, 1)
            place(y, note, b0 + s * beat / 2, 0.85)
        for off in (1.5, 3.5):
            dur = 0.22; st = filt_env_saw(chords[bar], dur, 700, 2600, 900, 0.03, (-6, 6)) * np.exp(-T(dur) / 0.12)
            place(y, st, b0 + off * beat, 0.55)
    loop = y[: int(total * SR)].copy(); wrap = y[int(total * SR):]
    loop[: len(wrap)] += wrap
    loop = sat(loop, 1.3)
    return peak_norm(loop, 0.8)
S["music"] = music

# ----------------------------------------------------------------- the voice
# Direction: a deep, commanding, cinematic arcade-fighting announcer. Exaggerated
# pronunciation, dramatic pauses, big reverb. Generated speech, processed; see the
# note at the top of this file about the underlying voice.
VOICE = {
    "v_get_ready": "[[rate 178]] Get [[slnc 50]] ready [[slnc 80]] for the [[slnc 40]] next [[slnc 70]] baaattle!",
    "v_fight": "[[rate 100]] Fiiiight!",
    "v_finish_him": "[[rate 150]] Finish [[slnc 100]] himmm!",
    "v_ko": "[[rate 102]] Kaay [[slnc 30]] Ohhh!",
    "v_wins": "[[rate 128]] Your pick [[slnc 90]] wins!",
    "v_next": "[[rate 170]] Next [[slnc 50]] challenger!",
    "v_destruction": "[[rate 158]] Absolute [[slnc 70]] destruction!",
}

def pv_stretch(x, rate, n_fft=1024, hop=256):
    """Phase-vocoder time stretch: rate>1 is faster/shorter, <1 slower/longer. Keeps pitch."""
    w = np.hanning(n_fft)
    _, _, Z = ss.stft(x, window=w, nperseg=n_fft, noverlap=n_fft - hop, boundary=None, padded=False)
    steps = np.arange(0, Z.shape[1] - 1, rate)
    omega = 2 * np.pi * hop * np.arange(Z.shape[0]) / n_fft
    phase = np.angle(Z[:, 0]); out = np.zeros((Z.shape[0], len(steps)), dtype=complex)
    for k, st in enumerate(steps):
        i = int(st); frac = st - i
        mag = (1 - frac) * np.abs(Z[:, i]) + frac * np.abs(Z[:, i + 1])
        out[:, k] = mag * np.exp(1j * phase)
        dphi = np.angle(Z[:, i + 1]) - np.angle(Z[:, i]) - omega
        dphi -= 2 * np.pi * np.round(dphi / (2 * np.pi))
        phase = phase + omega + dphi
    _, y = ss.istft(out, window=w, nperseg=n_fft, noverlap=n_fft - hop, boundary=False)
    return y

def pitch_shift(x, ratio, tempo=1.0):
    """ratio<1 lowers pitch (and the vocal tract: a 'bigger' voice); tempo<1 makes it slower."""
    from fractions import Fraction
    f = Fraction(ratio).limit_denominator(200)
    y = ss.resample_poly(x, f.denominator, f.numerator)       # plays slower and lower
    return pv_stretch(y, tempo / ratio)                       # bring duration back (tempo<1: a little slower)

def render_voice(key, text):
    with tempfile.TemporaryDirectory() as d:
        fn = os.path.join(d, "v.wav")
        subprocess.run(["say", "-v", "Ralph", "-o", fn, "--data-format=LEI16@22050", text], check=True)
        sr, x = wf.read(fn)
    x = x.astype(np.float64) / 32768.0
    idx = np.where(np.abs(x) > 0.01)[0]; x = x[max(0, idx[0] - 600): idx[-1] + 900]
    x = ss.resample_poly(x, 2, 1)                                   # 22.05k -> 44.1k
    deep = fade(pitch_shift(x, 2 ** (-4.0 / 12), 0.96), 0.003, 0.05)       # ~4 semitones down, a touch slower
    x = hp(deep, 60)
    dbl = fade(np.concatenate([np.zeros(int(0.014 * SR)), pitch_shift(x, 2 ** (-0.18 / 12))]), 0.003, 0.05)   # detuned double-track
    L = max(len(x), len(dbl)); y = np.zeros(L); y[: len(x)] += x; y[: len(dbl)] += 0.5 * dbl
    y += 0.55 * lp(y, 200)                                           # chest: low shelf
    y += 0.32 * bp(sat(y, 3), 1300, 4300)                            # bite / presence
    y = sat(y * 1.5, 2.8)                                            # grit and compression
    y = echo(y, 0.13, 0.22)
    y = reverb(y, rt=1.15, wet=0.3, damp=4500)                       # big hall tail
    return peak_norm(fade(y, 0.002, 0.08), 0.92)

def riser():
    """The buildup between 'get ready for the next battle' and 'FIGHT!': a timpani-roll
    that accelerates while a tone and a noise sweep climb."""
    n = 1.05; t = T(n); u = t / n; y = np.zeros_like(t)
    hits = 0.0; gap = 0.16
    while hits < n - 0.05:
        h = tone(96, 44, 0.25) * np.exp(-T(0.25) / 0.09); place(y, h, hits, 0.45 + 0.55 * (hits / n)); hits += gap; gap = max(0.045, gap * 0.82)
    y += lp(sweep_noise(n, 200, 6500, q=1.3), 9000) * (u ** 2.0) * 0.9
    y += lp(ss.sawtooth(2 * np.pi * np.cumsum(110 * (4.0 ** u)) / SR), 1400) * (u ** 1.6) * 0.4
    return peak_norm(fade(y, 0.01, 0.01), 0.85)
S["riser"] = riser

def fight_boom():
    """Detonation under 'FIGHT!': sub boom + brass stab + cymbal."""
    n = 1.5; t = T(n)
    boom = tone(70, 28, n) * np.exp(-t / 0.5)
    stab = filt_env_saw([146.83, 220.0, 293.66, 369.99], n, 700, 5200, 1500, 0.06) * np.exp(-t / 0.4)
    cym = hp(noise(n), 4500) * np.exp(-t / 0.55) * 0.35
    y = sat(boom * 1.3 + stab * 0.7 + cym, 1.8)
    return peak_norm(fade(reverb(y, 1.0, 0.28), 0.001, 0.12), 0.93)
S["fight_boom"] = fight_boom

# ----------------------------------------------------------------- write out
def write_m4a(name, x, kbps):
    os.makedirs(OUT, exist_ok=True)
    x16 = np.int16(np.clip(x, -1, 1) * 32767)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, name + ".wav"); wf.write(wav, SR, x16)
        out = os.path.join(OUT, name + ".m4a")
        subprocess.run(["afconvert", wav, out, "-f", "m4af", "-d", "aac", "-b", str(kbps * 1000), "-q", "127", "-s", "0"], check=True)
    return os.path.getsize(os.path.join(OUT, name + ".m4a"))

if __name__ == "__main__":
    only = set(sys.argv[1:])
    total = 0; rows = []
    for name, fn in S.items():
        if only and name not in only: continue
        x = fn(); kb = 96 if name == "music" else 80
        size = write_m4a(name, x, kb); total += size
        rows.append((name, len(x) / SR, float(np.max(np.abs(x))), float(np.sqrt(np.mean(x ** 2))), size))
    for key, text in VOICE.items():
        if only and key not in only: continue
        x = render_voice(key, text); size = write_m4a(key, x, 96); total += size
        rows.append((key, len(x) / SR, float(np.max(np.abs(x))), float(np.sqrt(np.mean(x ** 2))), size))
    print(f"{'name':16}{'sec':>6}{'peak':>7}{'rms':>7}{'bytes':>9}")
    for r in rows: print(f"{r[0]:16}{r[1]:6.2f}{r[2]:7.2f}{r[3]:7.3f}{r[4]:9d}")
    print("total bytes:", total)
