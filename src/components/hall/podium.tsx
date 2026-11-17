import { Crown, Trophy } from "./trophy";
import type { CreatorData } from "./types";

type Place = "gold" | "silver" | "bronze";

function Who({ c }: { c: CreatorData | null }) {
  return (
    <span className="pod-who" aria-hidden="true">
      {c ? (
        c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatarUrl} alt="" />
        ) : (
          c.name.slice(0, 1).toUpperCase()
        )
      ) : (
        "?"
      )}
    </span>
  );
}

function Pod({ place, rank, c, tie }: { place: Place; rank: number; c: CreatorData | null; tie: boolean }) {
  return (
    <li className={`pod ${place} ${c ? "" : "empty"}`} aria-label={c ? `${rank === 1 ? "First" : rank === 2 ? "Second" : "Third"} place: ${c.name}, score ${c.score}` : `${rank === 1 ? "First" : rank === 2 ? "Second" : "Third"} place is empty`}>
      {place === "gold" && c && <span className="pod-light" aria-hidden="true" />}
      {place === "gold" && c && <Crown className="crown" />}
      <Who c={c} />
      {c ? (
        <>
          <span className="pod-name">{c.name}</span>
          <span className="pod-score">+{c.score}</span>
          <span className="pod-sub">
            {c.posts} scored {c.posts === 1 ? "caption" : "captions"}
          </span>
          {tie && <span className="pod-tie">Tied on score</span>}
        </>
      ) : (
        <>
          <span className="pod-name text-muted">Awaiting a contender</span>
          <span className="pod-sub">Nobody qualifies yet</span>
        </>
      )}
      <span className="plinth" aria-hidden="true">
        {rank}
        {place === "gold" && c && <Trophy className="plinth-trophy" />}
      </span>
    </li>
  );
}

// The podium is built only from the real top creators the database returned. With
// fewer than three, the missing places stay honestly empty.
export function Podium({ creators, periodLabel }: { creators: CreatorData[]; periodLabel: string }) {
  const [first, second, third] = [creators[0] ?? null, creators[1] ?? null, creators[2] ?? null];
  const tie = (a: CreatorData | null, b: CreatorData | null) => Boolean(a && b && a.score === b.score);
  const note =
    creators.length === 0
      ? `No creator has a positive total score ${periodLabel}. The plinths are waiting.`
      : creators.length < 3
        ? `Only ${creators.length} ${creators.length === 1 ? "creator has" : "creators have"} a positive score ${periodLabel}. The other ${creators.length === 1 ? "plinths are" : "plinth is"} waiting.`
        : null;
  return (
    <section className="reveal podium-hall" aria-labelledby="podium-heading">
      <div className="text-center">
        <p className="eyebrow">The podium</p>
        <h2 id="podium-heading" className="mt-1 text-2xl sm:text-3xl">
          Top creators
        </h2>
      </div>
      <ol className="pods mt-6" aria-label="Top three creators">
        <Pod place="silver" rank={2} c={second} tie={tie(first, second)} />
        <Pod place="gold" rank={1} c={first} tie={false} />
        <Pod place="bronze" rank={3} c={third} tie={tie(second, third)} />
      </ol>
      <div className="pods-floor" aria-hidden="true" />
      {note && <p className="py-4 text-center text-sm text-muted">{note}</p>}
    </section>
  );
}
