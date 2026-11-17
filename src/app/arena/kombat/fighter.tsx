// A little photo-headed fighter. The head is the real photo from the matchup;
// the body is an HTML rig (rubber-hose limbs, glove-and-cuff hands, team vest)
// whose joints are driven entirely by CSS variables (see kombat.css and
// choreo.ts). Plain HTML + CSS transforms, so it behaves the same in Safari and
// Chrome. Purely decorative: aria-hidden.

export type Side = "a" | "b";

function Arm({ kind, hammer }: { kind: "back" | "front"; hammer?: boolean }) {
  return (
    <div className={`kf-arm ${kind}`}>
      <div className="kf-fore">
        {hammer && (
          <div className="kf-hammer">
            <i className="kf-hammer-handle" />
            <i className="kf-hammer-head" />
          </div>
        )}
        <i className="kf-glove" />
      </div>
    </div>
  );
}

function Leg({ kind }: { kind: "back" | "front" }) {
  return (
    <div className={`kf-leg ${kind}`}>
      <div className="kf-shin">
        <i className="kf-shoe" />
      </div>
    </div>
  );
}

export function Fighter({ side, src, cx }: { side: Side; src: string | null; cx: string }) {
  return (
    <div className="kf" data-side={side} style={{ "--cx": cx } as React.CSSProperties} aria-hidden="true">
      <div className="kf-shadow" />
      <div className="kf-rig">
        <div className="kf-body">
          <Leg kind="back" />
          <Leg kind="front" />
          <div className="kf-upper">
            <Arm kind="back" />
            <div className="kf-torso">
              <span className="kf-badge">{side === "a" ? "A" : "B"}</span>
              <i className="kf-belt" />
            </div>
            <div className="kf-head">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" draggable={false} />
              ) : (
                <span className="kf-head-empty">?</span>
              )}
              <i className="kf-ring" />
            </div>
            <Arm kind="front" hammer />
            <div className="kf-dizzy">
              <b>★</b>
              <b>★</b>
              <b>★</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
