"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Creature } from "@/components/creature";
import type { Mood } from "@/lib/mood";
import { Fighter } from "./fighter";
import { POSE, runMove, type Actor, type Ctx, type Fx, type MoveName, type Pose } from "./choreo";

export type Rect = { left: number; top: number; width: number; height: number };

export type FightProps = {
  /** The real photo of each caption: these become the fighters' heads. */
  heads: [string | null, string | null];
  /** The captions, shown on small nameplates under the fighters. */
  captions: [string, string];
  /** Which fighter the voter picked (they win the showdown). */
  winner: 0 | 1;
  move: MoveName;
  /** Time scale: 1 = full length, <1 = faster (later rounds). */
  k: number;
  /** Where each caption's photo is on screen, relative to the stage (for the card -> fighter morph). */
  from?: () => [Rect, Rect] | null;
  onDone: () => void;
  /** Debug/QA: freeze on a named pose instead of running. */
  debugPose?: keyof typeof POSE | null;
};

class Cancelled extends Error {}

const CX = ["27%", "73%"] as const;

export function FightStage({ heads, captions, winner, move, k, from, onDone, debugPose }: FightProps) {
  const stage = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const fxLayer = useRef<HTMLDivElement>(null);
  const refEl = useRef<HTMLDivElement>(null);
  const names = useRef<Array<HTMLDivElement | null>>([null, null]);
  const [ann, setAnn] = useState<{ text: string; kind: string; n: number } | null>(null);
  const [refMood, setRefMood] = useState<Mood>("idle");
  const [refOn, setRefOn] = useState(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useLayoutEffect(() => {
    const st = stage.current!;
    const kfs = Array.from(st.querySelectorAll<HTMLElement>(".kf"));
    if (kfs.length !== 2) return;
    let alive = true;
    const timers = new Set<number>();
    const anims = new Set<Animation>();
    const rejecters = new Set<(e: Error) => void>();
    let annN = 0;

    const sr = () => st.getBoundingClientRect();
    const u = kfs[0].getBoundingClientRect().width / 14;
    const stageW = st.clientWidth;
    const stageH = st.clientHeight;
    const floorY = kfs[0].offsetTop + kfs[0].offsetHeight - 0.6 * u;

    const actors: [Actor, Actor] = [0, 1].map((i) => {
      const el = kfs[i];
      return {
        i: i as 0 | 1,
        dir: i === 0 ? 1 : -1,
        el,
        rig: el.querySelector<HTMLElement>(".kf-rig")!,
        body: el.querySelector<HTMLElement>(".kf-body")!,
        head: el.querySelector<HTMLElement>(".kf-head")!,
        s: { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
      };
    }) as [Actor, Actor];

    const tf = (s: Actor["s"]) => `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${s.sx}, ${s.sy})`;
    const track = (a: Animation) => {
      anims.add(a);
      return a;
    };
    const wait = (ms: number) =>
      new Promise<void>((res, rej) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          rejecters.delete(rej);
          if (!alive) rej(new Cancelled());
          else res();
        }, ms * k);
        timers.add(id);
        rejecters.add(rej);
      });
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms * k);
      timers.add(id);
    };

    // ---- effects (imperative, auto-removed) --------------------------------
    const spawn = (html: string, x: number, y: number, ttl: number) => {
      const layer = fxLayer.current;
      if (!layer) return;
      const el = document.createElement("div");
      el.className = "kb-fx";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerHTML = html;
      layer.appendChild(el);
      later(() => el.remove(), ttl / k);
    };
    const fx: Fx = {
      burst: (x, y) => spawn('<i class="kb-burst"></i>', x, y, 520),
      sparks: (x, y, n = 10, colors = ["#ffe27a", "#fff", "#ffb23f", "#ff7a3a"], stars = false) => {
        let html = "";
        for (let i = 0; i < n; i++) {
          const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
          const dist = u * (5 + Math.random() * 7);
          const c = colors[i % colors.length];
          html += `<i class="kb-spark ${stars && i % 2 === 0 ? "star" : ""}" style="--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist}px;--c:${c}">${stars && i % 2 === 0 ? "✦" : ""}</i>`;
        }
        spawn(html, x, y, 760);
      },
      puff: (x, y, dx = -12) => spawn(`<i class="kb-puff" style="--dx:${dx}em"></i>`, x, y, 700),
      lines: (x, y, flip = false) => spawn(`<i class="kb-lines" style="${flip ? "transform:scaleX(-1)" : ""}"></i>`, x, y, 460),
      word: (x, y, text) => spawn(`<span class="kb-word">${text}</span>`, x, y, 1000),
      flash: () => {
        const el = document.createElement("div");
        el.className = "kb-flashfull";
        cam.current?.appendChild(el);
        later(() => el.remove(), 300 / k);
      },
      shake: (size) => {
        const c = cam.current;
        if (!c) return;
        delete c.dataset.shake;
        void c.offsetWidth;
        c.dataset.shake = size;
      },
    };

    const moveFn: Ctx["move"] = (a, to, ms, easing = "ease-out") => {
      const prev = { ...a.s };
      a.s = { ...a.s, ...to };
      const next = { ...a.s };
      const an = track(a.rig.animate([{ transform: tf(prev) }, { transform: tf(next) }], { duration: Math.max(1, ms * k), easing, fill: "forwards" }));
      return an.finished.then(
        () => {
          if (alive) a.rig.style.transform = tf(next);
          an.cancel();
          anims.delete(an);
        },
        () => {
          throw new Cancelled();
        },
      );
    };

    const ctx: Ctx = {
      winner: actors[winner],
      loser: actors[1 - winner],
      u,
      w: stageW,
      h: stageH,
      floorY,
      fx,
      wait,
      pose: (a, p: Pose, ms = 220, ease = "cubic-bezier(0.34, 1.35, 0.5, 1)") => {
        a.el.style.setProperty("--pd", `${ms * k}ms`);
        a.el.style.setProperty("--pe", ease);
        for (const [key, v] of Object.entries(p)) a.el.style.setProperty(`--${key}`, `${v}deg`);
      },
      move: moveFn,
      fly: (a, path, ms, easing = "ease-out") => {
        // A launched fighter tumbles about its middle, not its feet. Move the
        // transform origin and compensate so nothing visibly jumps.
        const dy = a.rig.offsetHeight * 0.48;
        const rr = (a.s.r * Math.PI) / 180;
        a.rig.style.transformOrigin = "50% 52%";
        const first = {
          ...a.s,
          x: a.s.x + Math.sin(rr) * a.s.sy * dy,
          y: a.s.y + dy - Math.cos(rr) * a.s.sy * dy,
        };
        let cur = { ...first };
        const frames: Keyframe[] = path.map((p, idx) => {
          const { at, ...rest } = p;
          cur = idx === 0 ? { ...first, ...rest, x: first.x, y: first.y } : { ...cur, ...rest };
          return { offset: at, transform: tf(cur), easing };
        });
        const last = { ...cur };
        a.s = last;
        const an = track(a.rig.animate(frames, { duration: ms * k, easing: "linear", fill: "forwards" }));
        return an.finished.then(
          () => {
            if (alive) a.rig.style.transform = tf(last);
            an.cancel();
            anims.delete(an);
          },
          () => {
            throw new Cancelled();
          },
        );
      },
      spin: (a, ms) => {
        const m = a.dir;
        const an = track(
          a.body.animate(
            [{ transform: `scaleX(${m})` }, { transform: `scaleX(${m * 0.1})` }, { transform: `scaleX(${-m})` }, { transform: `scaleX(${m * 0.1})` }, { transform: `scaleX(${m})` }],
            { duration: ms * k, easing: "ease-in-out" },
          ),
        );
        return an.finished.then(
          () => undefined,
          () => {
            throw new Cancelled();
          },
        );
      },
      headAnim: (a, frames, ms, easing = "ease-out") => {
        const fixed = frames.map((f) => ({ ...f, transform: String(f.transform).replace(/var\(--m\)/g, String(a.dir)) }));
        const an = track(a.head.animate(fixed, { duration: ms * k, easing }));
        return an.finished.then(
          () => undefined,
          () => {
            throw new Cancelled();
          },
        );
      },
      headPoint: (a) => {
        const r = a.head.getBoundingClientRect();
        const s = sr();
        return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
      },
      say: (text, kind) => setAnn({ text, kind, n: ++annN }),
      ref: (mood, jolt) => {
        setRefMood(mood as Mood);
        if (jolt && refEl.current) {
          const el = refEl.current;
          delete el.dataset.jolt;
          void el.offsetWidth;
          el.dataset.jolt = "true";
        }
      },
      prop: (a, on) => a.el.style.setProperty("--hm", on ? "1" : "0"),
      dizzy: (a, on) => {
        a.el.dataset.dizzy = on ? "true" : "false";
      },
      hide: (a) => {
        a.el.style.visibility = "hidden";
      },
      down: (a) => names.current[a.i]?.setAttribute("data-down", "true"),
    };

    // ---- the transformation: each photo grows arms and legs ----------------
    const rects = from?.() ?? null;
    const stageRect = sr();
    actors.forEach((a, i) => {
      a.el.dataset.ready = "true";
      const kf = a.el.getBoundingClientRect();
      const r = rects?.[i];
      if (r && !debugPose) {
        const fromBox = {
          left: `${r.left - (kf.left - stageRect.left)}px`,
          top: `${r.top - (kf.top - stageRect.top)}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          borderRadius: "1.1rem",
        };
        const hr = a.head.getBoundingClientRect();
        const toBox = { left: `${hr.left - kf.left}px`, top: `${hr.top - kf.top}px`, width: `${hr.width}px`, height: `${hr.height}px`, borderRadius: "50%" };
        track(a.head.animate([fromBox, toBox], { duration: 760 * k, easing: "cubic-bezier(0.22, 1.02, 0.3, 1)", fill: "both" }));
      }
      const parts = Array.from(a.el.querySelectorAll<HTMLElement>(".kf-torso, .kf-arm, .kf-leg"));
      parts.forEach((p, idx) => {
        const isTorso = p.classList.contains("kf-torso");
        track(
          p.animate(
            [
              { scale: "0", opacity: 0 },
              { scale: "1.14", opacity: 1, offset: 0.7 },
              { scale: "1", opacity: 1 },
            ],
            { duration: (isTorso ? 420 : 520) * k, delay: (isTorso ? 140 : 230 + idx * 25) * k, easing: "cubic-bezier(0.3, 1.2, 0.5, 1)", fill: "both" },
          ),
        );
      });
    });
    const nameBoxes = names.current;
    // The winner draws in front, so their weapon and fist are never hidden.
    actors[winner].el.style.zIndex = "7";

    const run = async () => {
      ctx.pose(actors[0], POSE.folded, 0);
      ctx.pose(actors[1], POSE.folded, 0);
      requestAnimationFrame(() => {
        if (!alive) return;
        st.dataset.on = "true";
      });
      if (debugPose) {
        ctx.pose(actors[0], POSE[debugPose], 0);
        ctx.pose(actors[1], POSE[debugPose], 0);
        setRefOn(true);
        return;
      }
      await wait(100);
      ctx.pose(actors[0], POSE.stance, 480);
      ctx.pose(actors[1], POSE.stance, 480);
      later(() => setRefOn(true), 380);
      ctx.ref("inspired");
      later(() => nameBoxes.forEach((n) => n?.setAttribute("data-on", "true")), 640);
      await wait(560);
      actors.forEach((a) => (a.el.dataset.idle = "true"));
      if (Math.random() < 0.6) ctx.say("FINISH HIM!", "small");
      await wait(520);
      actors.forEach((a) => delete a.el.dataset.idle);
      ctx.ref("curious");

      await runMove(move, ctx);

      ctx.down(ctx.loser);
      ctx.say("YOUR PICK WINS!", "win");
      await wait(850);
      st.dataset.leaving = "true";
      await wait(340);
      doneRef.current();
    };
    run().catch((e) => {
      if (!(e instanceof Cancelled)) throw e;
    });

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      anims.forEach((a) => a.cancel());
      anims.clear();
      rejecters.forEach((r) => r(new Cancelled()));
      rejecters.clear();
    };
    // The fight is configured once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={stage} className="kb-stage" data-on="false" data-move={move} aria-hidden="true">
      <div className="kb-crowd" />
      <div className="kb-floor" />
      <div ref={cam} className="kb-cam">
        <div ref={refEl} className="kb-ref" data-on={refOn ? "true" : "false"}>
          <div className="kb-ref-body">
            <Creature mood={refMood} />
          </div>
          <span className="kb-ref-tag">REF</span>
        </div>
        <Fighter side="a" src={heads[0]} cx={CX[0]} />
        <Fighter side="b" src={heads[1]} cx={CX[1]} />
        {([0, 1] as const).map((i) => (
          <div
            key={i}
            ref={(el) => {
              names.current[i] = el;
            }}
            className="kb-name"
            data-on="false"
            style={{ left: CX[i], ["--c" as string]: i === 0 ? "#ffb15a" : "#a3adff" }}
          >
            <b>
              Caption {i === 0 ? "A" : "B"}
              {winner === i ? " · your pick" : ""}
            </b>
            <span>{captions[i]}</span>
          </div>
        ))}
        <div ref={fxLayer} className="kb-fxlayer" />
      </div>
      {ann && (
        <div key={ann.n} className="kb-ann" data-kind={ann.kind} data-text={ann.text}>
          {ann.text}
        </div>
      )}
    </div>
  );
}
