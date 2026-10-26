import { LIBRARY, libraryUrl } from "@/lib/library";

// The homepage's scroll-driven story: a photo becomes a caption plate, a rival
// caption squares up against it, and one wins. All motion is CSS (see
// "Home: scroll-driven story" in globals.css); without support, or with
// reduced motion, it is a plain readable stack in its final state.
export function Story() {
  const photo = LIBRARY[1] ?? LIBRARY[0];

  return (
    <section aria-labelledby="story-title" className="story">
      <div className="story-track">
        <div className="story-stage">
          <div className="flex flex-col gap-5">
            <h2 id="story-title" className="text-3xl font-bold sm:text-4xl">
              From photo to punchline to <span className="text-accent-text">winner</span>.
            </h2>
            <ol className="story-steps">
              <li className="story-step">
                <b>1 · The photo stays exact</b>
                <span>Your picture is the one thing we never bend.</span>
              </li>
              <li className="story-step">
                <b>2 · The caption is the twist</b>
                <span>Pick a voice and get three takes on a bent glass plate. Remix until it lands.</span>
              </li>
              <li className="story-step">
                <b>3 · The Arena decides</b>
                <span>Two captions, one photo. The crowd picks the funnier one, and the authors are revealed.</span>
              </li>
            </ol>
          </div>

          <div>
            <div className="story-scene" aria-hidden="true">
              <div className="story-photo">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={libraryUrl(photo.file)} alt="" loading="lazy" decoding="async" />
                )}
              </div>
              <div className="story-duel">
                <div className="story-plate bend-plate plate-glass">
                  <span className="story-crown">Funnier</span>
                  <p className="text-lg font-semibold leading-snug tracking-tight">
                    Not sleeping, just buffering.
                  </p>
                </div>
                <span className="story-vs">VS</span>
                <div className="story-rival story-rival-lose bend-plate plate-glass">
                  <p className="text-lg font-semibold leading-snug tracking-tight">
                    Powered by caffeine and denial.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Illustration with sample captions.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
