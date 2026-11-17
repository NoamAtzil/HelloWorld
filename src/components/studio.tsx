"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { generateTakes, publishCaption, remixCaption } from "@/app/studio/actions";
import { dataUrlToFile, downscale, fileToDataUrl } from "@/lib/image-client";
import { LIBRARY, libraryUrl, type LibraryItem } from "@/lib/library";
import { Photo } from "@/components/photo";
import { Guide } from "@/components/guide";
import { SubmissionCeremony } from "@/components/drop/submission-ceremony";
import { Icon } from "@/components/icons";
import { dropGuidance, studioGuidance } from "@/lib/guidance";
import { voiceTheme } from "@/lib/voice-theme";
import { downloadCard } from "@/lib/share-card";
import type { PublishResult, RemixResult, TakesResult } from "@/lib/studio-types";
import {
  DEFAULT_VOICE,
  DIRECTION_IDEAS,
  REMIX_MODES,
  VOICES,
  type RemixMode,
  type VoiceId,
} from "@/lib/voices";

type Source =
  | { kind: "library"; item: LibraryItem }
  | { kind: "upload"; file: File; url: string };

type Take = { text: string; history: string[] };

// What a result was generated from; publishing uses this snapshot so a later
// change to the controls can never mismatch the caption.
type Generated = { file: File; previewUrl: string; slug: string | null; voice: VoiceId; direction: string };

type Challenge = { date: string; file: string; title: string; theme: string | null };

const DRAFT_KEY = "caption.studio.draft.v1";
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

// A thrown redirect must still reach Next; real failures become inline text.
function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again.";

export function Studio({
  signedIn,
  challenge = null,
  alreadyEntered = false,
  heading = "Drop a photo. Get the joke.",
}: {
  signedIn: boolean;
  /** Daily Drop mode: the photo is fixed to today's challenge. */
  challenge?: Challenge | null;
  alreadyEntered?: boolean;
  heading?: string;
}) {
  const dropItem: LibraryItem | null = challenge
    ? LIBRARY.find((item) => item.file === challenge.file) ?? null
    : null;

  const [source, setSource] = useState<Source | null>(
    dropItem ? { kind: "library", item: dropItem } : LIBRARY[0] ? { kind: "library", item: LIBRARY[0] } : null,
  );
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  const [direction, setDirection] = useState("");
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [busy, setBusy] = useState<null | "generate" | "remix" | "publish" | "card">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [share, setShare] = useState(false);
  const [published, setPublished] = useState<Extract<PublishResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);
  // The Daily Drop submission ceremony: only ever set after the server confirms the entry.
  const [ceremony, setCeremony] = useState<{ caption: string; from: DOMRect | null } | null>(null);
  const plate = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const working = useRef(false);
  const uploadUrl = useRef<string | null>(null);
  const resultUrls = useRef<string[]>([]);
  const canRemix = signedIn;
  const preview = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
      resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  // After signing in from a guest result, pick up where the visitor left off.
  useEffect(() => {
    if (!signedIn || challenge) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    void (async () => {
      try {
        const draft = JSON.parse(raw) as {
          imageDataUrl: string;
          slug: string | null;
          voice: VoiceId;
          direction: string;
          takes: Take[];
          selected: number;
        };
        const file = await dataUrlToFile(draft.imageDataUrl, "photo.jpg");
        const sourceUrl = URL.createObjectURL(file);
        const previewUrl = URL.createObjectURL(file);
        resultUrls.current.push(previewUrl);
        if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
        uploadUrl.current = sourceUrl;
        setSource({ kind: "upload", file, url: sourceUrl });
        setVoice(draft.voice);
        setDirection(draft.direction);
        setTakes(draft.takes);
        setSelected(Math.min(draft.selected, draft.takes.length - 1));
        setGenerated({ file, previewUrl, slug: draft.slug, voice: draft.voice, direction: draft.direction });
        setNotice("Welcome back! Your captions are right where you left them.");
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }
    })();
  }, [signedIn, challenge]);

  function resetResult() {
    setTakes(null);
    setGenerated(null);
    setSelected(0);
    setError(null);
    setNotice(null);
    setPublished(null);
  }

  function chooseLibrary(item: LibraryItem) {
    if (challenge) return;
    setSource({ kind: "library", item });
    resetResult();
  }

  function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || challenge) return;
    if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
    const url = URL.createObjectURL(file);
    uploadUrl.current = url;
    setSource({ kind: "upload", file, url });
    resetResult();
  }

  function shuffle() {
    if (!challenge && LIBRARY.length > 0) {
      const others = LIBRARY.filter((item) => !(source?.kind === "library" && source.item.file === item.file));
      setSource({ kind: "library", item: pick(others.length ? others : LIBRARY) });
    }
    setVoice(pick(VOICES).id);
    setDirection(pick(DIRECTION_IDEAS));
    resetResult();
  }

  // Get the bytes for the current source, shrunk to the upload budget.
  async function prepareImage(): Promise<File | null> {
    if (!source) return null;
    let file: File;
    if (source.kind === "upload") {
      file = source.file;
    } else {
      const response = await fetch(libraryUrl(source.item.file));
      if (!response.ok) throw new Error("library image unavailable");
      const blob = await response.blob();
      file = new File([blob], source.item.file, { type: blob.type });
    }
    return downscale(file, signedIn ? 1600 : 1280, signedIn ? 3_500_000 : 1_400_000);
  }

  async function generate() {
    if (working.current) return;
    if (!source) {
      setError("Choose a photo to caption.");
      return;
    }
    working.current = true;
    setBusy("generate");
    setError(null);
    setNotice(null);
    setPublished(null);
    try {
      const file = await prepareImage();
      if (!file) return;
      const form = new FormData();
      form.set("image", file);
      form.set("voice", voice);
      form.set("prompt", direction);
      form.set("slug", source.kind === "library" ? source.item.file : "");
      let result: TakesResult;
      try {
        result = await generateTakes(form);
      } catch (e) {
        if (isRedirect(e)) throw e;
        result = { ok: false, error: NETWORK_ERROR };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      resultUrls.current.push(previewUrl);
      setGenerated({
        file,
        previewUrl,
        slug: source.kind === "library" ? source.item.file : null,
        voice,
        direction: direction.trim() || "Write a funny caption for this photo.",
      });
      setTakes(result.takes.map((text) => ({ text, history: [] })));
      setSelected(0);
      setRemaining(result.remaining);
    } catch (e) {
      if (isRedirect(e)) throw e;
      setError("Couldn't load that image. Try another one.");
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  async function remix(mode: RemixMode) {
    if (working.current || !takes || !generated) return;
    working.current = true;
    setBusy("remix");
    setError(null);
    const current = takes[selected];
    try {
      const form = new FormData();
      form.set("caption", current.text);
      form.set("mode", mode);
      form.set("voice", generated.voice);
      let result: RemixResult;
      try {
        result = await remixCaption(form);
      } catch (e) {
        if (isRedirect(e)) throw e;
        result = { ok: false, error: NETWORK_ERROR };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTakes((list) =>
        list
          ? list.map((take, i) =>
              i === selected ? { text: result.caption, history: [...take.history, take.text] } : take,
            )
          : list,
      );
      setRemaining(result.remaining);
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  function undoRemix() {
    setTakes((list) =>
      list
        ? list.map((take, i) =>
            i === selected && take.history.length
              ? { text: take.history[take.history.length - 1], history: take.history.slice(0, -1) }
              : take,
          )
        : list,
    );
  }

  async function publish() {
    if (working.current || !takes || !generated) return;
    working.current = true;
    setBusy("publish");
    setError(null);
    try {
      const form = new FormData();
      form.set("image", generated.file);
      form.set("caption", takes[selected].text);
      form.set("prompt", generated.direction);
      form.set("voice", generated.voice);
      form.set("slug", generated.slug ?? "");
      if (share && !challenge) form.set("share", "1");
      if (challenge) form.set("drop", "1");
      let result: PublishResult;
      try {
        result = await publishCaption(form);
      } catch (e) {
        if (isRedirect(e)) throw e;
        result = { ok: false, error: NETWORK_ERROR };
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPublished(result);
      if (challenge && result.drop && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setCeremony({ caption: takes[selected].text, from: plate.current?.getBoundingClientRect() ?? null });
      }
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  // Guests keep their result across the Google sign-in round trip.
  async function signInToPublish() {
    if (!takes || !generated) return;
    try {
      const imageDataUrl = await fileToDataUrl(generated.file);
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          imageDataUrl,
          slug: generated.slug,
          voice: generated.voice,
          direction: generated.direction,
          takes,
          selected,
        }),
      );
    } catch {
      /* storage full/blocked: sign in anyway, the result just won't carry over */
    }
    router.push("/login?next=/studio");
  }

  async function copyCaption() {
    if (!takes) return;
    try {
      await navigator.clipboard.writeText(takes[selected].text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy. Select the caption text instead.");
    }
  }

  async function saveCard() {
    if (!takes || !generated || working.current) return;
    working.current = true;
    setBusy("card");
    try {
      await downloadCard(generated.previewUrl, takes[selected].text);
    } catch {
      setError("Couldn't make the card. Try again.");
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  const current = takes?.[selected] ?? null;
  const previewSrc = generated
    ? generated.previewUrl
    : source?.kind === "upload"
      ? source.url
      : source
        ? libraryUrl(source.item.file)
        : null;
  const previewAlt = source?.kind === "library" ? source.item.title : "Your chosen photo";
  const generating = busy === "generate";
  const locked = busy !== null;

  // What the Caption Creature says: a pure function of the real state above.
  const guidance = studioGuidance({
    signedIn,
    challenge: Boolean(challenge),
    hasPhoto: Boolean(source),
    busy,
    hasTakes: Boolean(takes && takes.length > 0),
    published: published ? { drop: Boolean(published.drop) } : null,
    error,
    typing: Boolean(challenge && !takes && direction.trim()),
  });

  // On a phone the preview sits below the controls: bring it into view when work starts.
  useEffect(() => {
    if (busy !== "generate" || window.innerWidth >= 1024) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    preview.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [busy]);

  if (challenge && alreadyEntered && !published) {
    return (
      <div className="panel p-6">
        <Guide guidance={dropGuidance({ signedIn, hasChallenge: true, alreadyEntered: true, entries: null })} eyebrow="Daily Drop" />
        <p className="mt-3 text-sm text-muted">One entry per person per day. Vote on the other captions below.</p>
      </div>
    );
  }

  return (
    <div id="studio" className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      {ceremony && (
        <SubmissionCeremony
          caption={ceremony.caption}
          from={ceremony.from}
          onDone={() => {
            setCeremony(null);
            // Pull in the new entry, the entry count, and "you're in" from the server.
            router.refresh();
          }}
        />
      )}
      {/* LEFT: photo, voice, and the joke's direction */}
      <section className="panel flex flex-col gap-6 p-5 sm:p-6" aria-label="Choose a photo and a voice">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">The Studio</p>
            <h2 className="mt-1 text-2xl sm:text-3xl">{challenge ? `Caption today's photo` : heading}</h2>
          </div>
          <button type="button" onClick={shuffle} disabled={locked} className="btn-quiet btn-sm press" title="Random photo, voice, and direction">
            <Icon name="shuffle" className="h-4 w-4" /> Shuffle
          </button>
        </div>

        {/* Photo source */}
        {!challenge && (
          <div className="flex flex-col gap-2">
            <p id="photo-label" className="label !mb-0">1 · Photo</p>
            <ul aria-labelledby="photo-label" className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 py-1.5">
              <li className="shrink-0">
                <label
                  className={`press group relative grid h-16 w-16 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line-strong bg-sunken text-accent-text transition-colors hover:border-accent hover:bg-tint focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent sm:h-20 sm:w-20 ${
                    source?.kind === "upload" ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
                  }`}
                  title="Upload your own photo"
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUpload} disabled={locked} aria-label="Upload your own photo (JPEG, PNG, or WebP)" className="absolute inset-0 cursor-pointer opacity-0" />
                  <span className="flex flex-col items-center gap-0.5 text-[0.65rem] font-semibold">
                    <Icon name="upload" className="h-5 w-5 transition-transform group-hover:scale-110" />
                    Upload
                  </span>
                </label>
              </li>
              {LIBRARY.map((item) => {
                const isSelected = source?.kind === "library" && source.item.file === item.file;
                return (
                  <li key={item.file} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => chooseLibrary(item)}
                      disabled={locked}
                      aria-pressed={isSelected}
                      aria-label={item.title}
                      title={item.title}
                      className={`press relative block h-16 w-16 overflow-hidden rounded-2xl bg-tint-2 transition-all sm:h-20 sm:w-20 ${
                        isSelected ? "scale-[0.96] ring-2 ring-accent shadow-[var(--shadow-glow)] ring-offset-2 ring-offset-bg" : "hover:scale-[1.04]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={libraryUrl(item.file)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      {isSelected && (
                        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-on-accent" aria-hidden="true">
                          <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {challenge && (
          <p className="rounded-2xl bg-tint px-4 py-3 text-sm text-ink-2">
            Today&apos;s photo: <span className="font-semibold text-accent-text">{challenge.title}</span>
            {challenge.theme ? ` · ${challenge.theme}` : ""}
          </p>
        )}

        {/* Voice */}
        <div className="flex flex-col gap-2">
          <p id="voice-label" className="label !mb-0">2 · Voice</p>
          <div role="group" aria-labelledby="voice-label" className="flex flex-wrap gap-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={voice === v.id}
                title={v.blurb}
                disabled={locked}
                onClick={() => setVoice(v.id)}
                className={`press inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
                  voice === v.id
                    ? "border-accent bg-tint font-semibold text-accent-text shadow-[var(--shadow-sm)]"
                    : "border-line-strong bg-surface-solid font-medium text-muted hover:border-accent hover:text-ink"
                }`}
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${voiceTheme(v.id).from}, ${voiceTheme(v.id).to})` }} />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="studio-direction" className="label !mb-0">
            3 · Steer the joke <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="studio-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            maxLength={200}
            disabled={locked}
            placeholder="roast this · make it dramatic · focus on the guy in the background"
            className="field"
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={locked || !source}
            className={`${takes ? "btn-quiet" : "btn-primary"} btn-lg press w-full`}
          >
            {generating ? (
              <>
                <span className="spinner" /> Finding the joke…
              </>
            ) : (
              <>
                <Icon name="spark" className="h-[1.1rem] w-[1.1rem]" /> {takes ? "Generate again" : "Generate 3 captions"}
              </>
            )}
          </button>
          <p className="text-center text-sm text-muted">
            {signedIn
              ? remaining !== null
                ? `${remaining} AI ${remaining === 1 ? "request" : "requests"} left today`
                : "Three takes per request."
              : remaining !== null
                ? `${remaining} free ${remaining === 1 ? "caption" : "captions"} left today`
                : "A few free captions a day. No sign-in needed."}
          </p>
        </div>
      </section>

      {/* RIGHT: the live preview, with the Caption Creature */}
      <div className="no-scrollbar lg:sticky lg:top-[5.25rem] lg:-m-3 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-3">
        <section ref={preview} className="panel flex scroll-mt-24 flex-col gap-5 p-5 sm:p-6" aria-label="Live preview">
          <Guide guidance={guidance} eyebrow={challenge ? "Your host" : "Live preview"} />

          <div>
            <Photo src={previewSrc} alt={previewAlt} size={challenge ? "drop" : "studio"} fixed loading="eager" fallback="Choose a photo on the left">
              {generating && <span className="scan" aria-hidden="true" />}
              {generating && (
                <span className="liquid absolute left-3 top-3 z-[2] inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-ink">
                  <span className="spinner !h-3 !w-3" /> Reading the photo
                </span>
              )}
            </Photo>
            <div ref={plate} className={`liquid liquid-strong relative z-[1] mx-3 -mt-10 rounded-2xl px-5 pb-5 pt-4 ${current ? "" : "!border-dashed"}`}>
              {current ? (
                <p key={`${selected}-${current.text}`} aria-live="polite" className="plate-in caption-text text-[1.35rem] sm:text-2xl">
                  {current.text}
                </p>
              ) : (
                <p aria-live="polite" className="text-base font-medium text-accent-text">
                  {generating ? "Finding the joke…" : "Your caption lands here"}
                </p>
              )}
            </div>
          </div>

          {/* Three takes + remix */}
          {takes && takes.length > 0 && (
            <div className="flex flex-col gap-3">
              {takes.length > 1 && (
                <div role="group" aria-label="Caption takes" className="grid grid-flow-col gap-1 rounded-2xl bg-sunken p-1 ring-1 ring-line">
                  {takes.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelected(i)}
                      aria-pressed={selected === i}
                      aria-label={`Take ${i + 1} of ${takes.length}`}
                      className={`min-h-9 rounded-xl px-4 text-sm transition-all ${
                        selected === i ? "bg-surface-solid font-semibold text-accent-text shadow-[var(--shadow-sm)]" : "font-medium text-muted hover:text-ink"
                      }`}
                    >
                      Take {i + 1}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Remix this caption">
                <span className="text-sm font-medium text-muted">Remix:</span>
                {REMIX_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    disabled={locked || !canRemix}
                    onClick={() => void remix(mode.id)}
                    className="chip press !px-3 !py-1.5 transition-colors hover:bg-tint-2 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Icon name="wand" className="h-3 w-3" /> {mode.label}
                  </button>
                ))}
                {current && current.history.length > 0 && (
                  <button type="button" onClick={undoRemix} disabled={locked} className="btn-ghost btn-sm">
                    <Icon name="retry" className="h-3.5 w-3.5" /> Undo
                  </button>
                )}
              </div>
              {!canRemix && (
                <p className="-mt-1 text-sm text-muted">
                  Remixing is for members.{" "}
                  <button type="button" onClick={() => void signInToPublish()} className="font-semibold text-accent-text underline-offset-2 hover:underline">
                    Sign in to unlock it
                  </button>
                  .
                </p>
              )}
            </div>
          )}

          {notice && (
            <p role="status" className="rounded-2xl bg-tint px-4 py-3 text-sm font-medium text-accent-text">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-coral-tint px-4 py-3 text-sm font-medium text-coral-text">
              {error}
              {!signedIn && /Sign in/.test(error) && (
                <>
                  {" "}
                  <Link href="/login?next=/studio" className="font-semibold underline">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          )}

          {published ? (
            <div role="status" className="result-card flex flex-col gap-4 p-5">
              <p className="eyebrow flex items-center gap-1.5">
                <Icon name="spark" className="h-3.5 w-3.5" /> {published.drop ? "You're in today's Drop" : "Published"}
              </p>
              {current && <p className="caption-text text-2xl">{current.text}</p>}
              <p className="text-sm text-muted">
                {published.drop
                  ? "Your caption is live. Voting stays open until the day ends."
                  : published.shared
                    ? "It's in the feed, and shared publicly on your choice."
                    : "It's in the feed for other members. Only members can see it."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={published.drop ? "/drop" : "/feed"} className="btn-primary btn-sm press">
                  {published.drop ? "See the Drop" : "See it in the feed"}
                </Link>
                {published.shared && (
                  <Link href={`/c/${published.id}`} className="btn-quiet btn-sm press">
                    Open public page
                  </Link>
                )}
                {!challenge && (
                  <button type="button" className="btn-ghost btn-sm press" onClick={() => resetResult()}>
                    <Icon name="retry" /> Make another
                  </button>
                )}
              </div>
            </div>
          ) : (
            takes &&
            current && (
              <div className="flex flex-col gap-3 rounded-2xl bg-sunken p-4 ring-1 ring-line">
                {signedIn ? (
                  <>
                    {!challenge && (
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                        <span>
                          <span className="font-semibold">Also share publicly</span>
                          <span className="block text-muted">
                            Anyone, even without an account, could see this photo, caption and your first name. Leave it off to share with members only.
                          </span>
                        </span>
                      </label>
                    )}
                    <button type="button" onClick={() => void publish()} disabled={locked} className="btn-primary press w-full sm:w-auto sm:self-start">
                      {busy === "publish" ? "Publishing…" : challenge ? "Enter today's Drop" : "Publish this caption"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted">Publishing, voting and saving need a free account. Your captions will be waiting for you after you sign in.</p>
                    <button type="button" onClick={() => void signInToPublish()} className="btn-primary press w-full sm:w-auto sm:self-start">
                      Sign in to publish
                    </button>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyCaption()} className="btn-quiet btn-sm press">
                    <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied!" : "Copy caption"}
                  </button>
                  <button type="button" onClick={() => void saveCard()} disabled={locked} className="btn-quiet btn-sm press">
                    <Icon name="photo" /> {busy === "card" ? "Making card…" : "Download card"}
                  </button>
                </div>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
