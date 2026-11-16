import { useId } from "react";
import type { Mood } from "@/lib/mood";

const MOUTH: Record<Mood, "neutral" | "o" | "smirk" | "grin" | "worry"> = {
  idle: "neutral",
  curious: "o",
  squint: "smirk",
  thinking: "neutral",
  inspired: "grin",
  proud: "smirk",
  confused: "worry",
};

// The Caption Creature: a small, slightly lopsided orange creature with a
// speech-bubble tail, mismatched ears and eyes, an "idea" antenna that glows,
// and a quote mark on its belly. Rendered with layered gradients (rim light,
// specular, soft contact shadow) for a gentle 3D look. All expression is CSS,
// driven by `mood` (see studio.css), so it costs no JavaScript at runtime.
export function Creature({ mood = "idle", className = "" }: { mood?: Mood; className?: string }) {
  const u = `cr${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const g = (k: string) => `url(#${u}${k})`;

  return (
    <svg className={`cr ${className}`} data-mood={mood} data-mouth={MOUTH[mood]} viewBox="0 0 200 224" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${u}b`} cx=".36" cy=".26" r=".92">
          <stop offset="0" stopColor="#ffd6ac" />
          <stop offset=".3" stopColor="#ffa35d" />
          <stop offset=".64" stopColor="#f0702a" />
          <stop offset="1" stopColor="#b43a0a" />
        </radialGradient>
        <radialGradient id={`${u}l`} cx=".4" cy=".3" r=".9">
          <stop offset="0" stopColor="#ff9a52" />
          <stop offset="1" stopColor="#c3470f" />
        </radialGradient>
        <radialGradient id={`${u}belly`} cx=".5" cy=".3" r=".72">
          <stop offset="0" stopColor="#fff0da" />
          <stop offset="1" stopColor="#ffc693" />
        </radialGradient>
        <radialGradient id={`${u}eye`} cx=".4" cy=".34" r=".82">
          <stop offset="0" stopColor="#fffefa" />
          <stop offset="1" stopColor="#f0dfc9" />
        </radialGradient>
        <radialGradient id={`${u}pup`} cx=".38" cy=".3" r=".82">
          <stop offset="0" stopColor="#5e3016" />
          <stop offset="1" stopColor="#1a0903" />
        </radialGradient>
        <radialGradient id={`${u}bulb`} cx=".38" cy=".32" r=".8">
          <stop offset="0" stopColor="#fff7cc" />
          <stop offset=".5" stopColor="#ffb92f" />
          <stop offset="1" stopColor="#e1760f" />
        </radialGradient>
        <radialGradient id={`${u}glow`}>
          <stop offset="0" stopColor="#ffd46b" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffb02e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}sh`}>
          <stop offset="0" stopColor="#4a1d04" stopOpacity=".42" />
          <stop offset="1" stopColor="#4a1d04" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}spec`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${u}rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2da" stopOpacity=".95" />
          <stop offset=".5" stopColor="#ffc890" stopOpacity="0" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity=".55" />
        </linearGradient>
        <clipPath id={`${u}body`}><path d="M100 36C152 34 178 84 173 130C169 178 138 204 100 204C60 204 28 180 27 132C25 86 50 38 100 36Z" /></clipPath>
        <clipPath id={`${u}cl`}><ellipse cx="78" cy="102" rx="18" ry="20" /></clipPath>
        <clipPath id={`${u}cr`}><ellipse cx="126" cy="100" rx="15.5" ry="17.5" /></clipPath>
      </defs>

      <ellipse cx="100" cy="214" rx="58" ry="8.5" fill={g("sh")} />
      {/* the speech-bubble tail */}
      <path d="M48 176C35 189 29 203 15 211C34 213 59 207 73 192Z" fill={g("l")} />
      <ellipse cx="80" cy="203" rx="16" ry="10" fill={g("l")} />
      <ellipse cx="122" cy="204" rx="16" ry="10" fill={g("l")} />

      <g className="cr-torso">
        <g className="cr-breath">
          <g transform="rotate(-27 61 43)"><ellipse cx="61" cy="43" rx="13" ry="19" fill={g("l")} /><ellipse cx="62" cy="46" rx="6.5" ry="11.5" fill="#ffbd8e" opacity=".75" /></g>
          <g transform="rotate(24 137 49)"><ellipse cx="137" cy="49" rx="11" ry="16" fill={g("l")} /><ellipse cx="137" cy="52" rx="5.5" ry="9.5" fill="#ffbd8e" opacity=".75" /></g>

          <path d="M100 36C152 34 178 84 173 130C169 178 138 204 100 204C60 204 28 180 27 132C25 86 50 38 100 36Z" fill={g("b")} />
          <path d="M100 36C152 34 178 84 173 130C169 178 138 204 100 204C60 204 28 180 27 132C25 86 50 38 100 36Z" fill="none" stroke={g("rim")} strokeWidth="3.2" />
          <ellipse cx="100" cy="164" rx="41" ry="35" fill={g("belly")} opacity=".92" />
          <text x="100" y="196" textAnchor="middle" fontFamily="var(--font-fraunces), Georgia, serif" fontSize="62" fontWeight="700" fill="#e98946" opacity=".5">&rdquo;</text>
          <g clipPath={g("body")}><ellipse cx="62" cy="72" rx="30" ry="6.5" transform="rotate(-54 62 72)" fill={g("spec")} opacity=".75" /></g>

          <g className="cr-arm l"><ellipse cx="29" cy="138" rx="11" ry="17" transform="rotate(14 29 138)" fill={g("l")} /></g>
          <g className="cr-arm r"><ellipse cx="171" cy="134" rx="11" ry="17" transform="rotate(-14 171 134)" fill={g("l")} /></g>

          <ellipse cx="52" cy="128" rx="9.5" ry="6" fill="#ff5a2a" opacity=".36" />
          <ellipse cx="152" cy="126" rx="9.5" ry="6" fill="#ff5a2a" opacity=".36" />

          <g className="cr-blink">
            <g className="cr-eye l">
              <ellipse cx="78" cy="102" rx="18" ry="20" fill={g("eye")} />
              <g clipPath={g("cl")}>
                <g className="cr-pupils">
                  <circle cx="78" cy="104" r="9.6" fill={g("pup")} />
                  <circle cx="74.2" cy="99.6" r="3.3" fill="#fff" />
                  <circle cx="82.2" cy="108.4" r="1.6" fill="#fff" opacity=".7" />
                </g>
                <rect className="cr-lid l" x="58" y="80" width="40" height="46" fill="#f27c31" />
              </g>
              <ellipse cx="78" cy="102" rx="18" ry="20" fill="none" stroke="#c9a57f" strokeWidth="1" opacity=".5" />
            </g>
            <g className="cr-eye r">
              <ellipse cx="126" cy="100" rx="15.5" ry="17.5" fill={g("eye")} />
              <g clipPath={g("cr")}>
                <g className="cr-pupils">
                  <circle cx="126" cy="102" r="8.6" fill={g("pup")} />
                  <circle cx="122.6" cy="98" r="3" fill="#fff" />
                  <circle cx="129.8" cy="106" r="1.5" fill="#fff" opacity=".7" />
                </g>
                <rect className="cr-lid r" x="108" y="80" width="36" height="40" fill="#f27c31" />
              </g>
              <ellipse cx="126" cy="100" rx="15.5" ry="17.5" fill="none" stroke="#c9a57f" strokeWidth="1" opacity=".5" />
            </g>
          </g>

          <g className="cr-brow l"><path d="M60 78Q76 69 95 76" fill="none" stroke="#7a2f08" strokeWidth="5.5" strokeLinecap="round" /></g>
          <g className="cr-brow r"><path d="M112 75Q126 69 142 75" fill="none" stroke="#7a2f08" strokeWidth="5.5" strokeLinecap="round" /></g>

          <g className="cr-mouth">
            <path className="m-neutral" d="M91 141Q103 147 115 140" fill="none" stroke="#6b2706" strokeWidth="4" strokeLinecap="round" />
            <g className="m-o"><ellipse cx="103" cy="142" rx="6.5" ry="8" fill="#5a1f06" /><ellipse cx="103" cy="146" rx="3.6" ry="2.6" fill="#ff7a5a" opacity=".85" /></g>
            <g className="m-smirk"><path d="M88 140Q105 151 119 134" fill="none" stroke="#6b2706" strokeWidth="4" strokeLinecap="round" /><path d="M120 132q3.5 1 4.5 5" fill="none" stroke="#6b2706" strokeWidth="3" strokeLinecap="round" /></g>
            <g className="m-grin"><path d="M85 134Q103 160 123 133Z" fill="#5a1f06" /><ellipse cx="103" cy="148.5" rx="9" ry="4.6" fill="#ff7a5a" /></g>
            <path className="m-worry" d="M89 147Q96 139 103 146T117 145" fill="none" stroke="#6b2706" strokeWidth="4" strokeLinecap="round" />
          </g>

          <g className="cr-ant">
            <circle className="cr-glow" cx="119" cy="9" r="26" fill={g("glow")} />
            <path d="M104 40C100 23 117 21 119 8" fill="none" stroke="#c2480e" strokeWidth="5" strokeLinecap="round" />
            <circle cx="119" cy="8" r="7.6" fill={g("bulb")} />
            <circle cx="116.6" cy="5.4" r="2.2" fill="#fff" opacity=".85" />
          </g>
        </g>
      </g>
    </svg>
  );
}
