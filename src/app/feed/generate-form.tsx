"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import libraryJson from "@/lib/image-library.json";
import { generateCaption, type GenerateFormState } from "./actions";

const MAX_DIMENSION = 1600;

type Mode = "upload" | "library";
type LibraryItem = { file: string; title: string };

// Generated from public/library/ by scripts/build-image-library.mjs.
const library: LibraryItem[] = libraryJson;

const libraryUrl = (file: string) => `/library/${encodeURIComponent(file)}`;

// Phone photos are far larger than the server action's body limit, so shrink
// to a JPEG in the browser first. If the browser can't decode the file, send
// it unchanged and let the server give the error.
async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

// A thrown redirect (e.g. the session expired) must still reach Next so the
// user is sent to /login; only genuine failures become an inline message.
function isRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

// If the request itself fails (offline, dropped connection), the server action
// call rejects. Without this, that rejection goes to the error boundary instead
// of the form; here it becomes a normal inline error and the form stays as is.
async function runGenerate(
  previous: GenerateFormState,
  formData: FormData,
): Promise<GenerateFormState> {
  try {
    return await generateCaption(previous, formData);
  } catch (error) {
    if (isRedirect(error)) throw error;
    return {
      error:
        "We couldn't reach the server, so your post may not have gone through. Check your connection and try again.",
    };
  }
}

export function GenerateForm({ onPosted }: { onPosted?: () => void }) {
  const [state, formAction, pending] = useActionState<
    GenerateFormState,
    FormData
  >(runGenerate, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const hasLibrary = library.length > 0;

  const [mode, setMode] = useState<Mode>("upload");
  const [localError, setLocalError] = useState<string | null>(null);

  // Blocks double submits while the photo is being prepared (before the
  // server action starts and `pending` turns on).
  const busy = useRef(false);
  const [preparing, setPreparing] = useState(false);

  // Local preview of the chosen photo. `at` remembers which action result was
  // current when it was picked, so a successful generation clears the preview
  // without needing an effect that sets state.
  const [picked, setPicked] = useState<{
    url: string;
    name: string;
    file: File;
    at: GenerateFormState;
  } | null>(null);
  const showPreview = picked && !(state?.ok && picked.at !== state);

  // Same idea for the image chosen from the library.
  const [chosen, setChosen] = useState<{
    item: LibraryItem;
    at: GenerateFormState;
  } | null>(null);
  const chosenItem =
    chosen && !(state?.ok && chosen.at !== state) ? chosen.item : null;

  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending, state]);

  // After a successful post, empty the form so the next photo starts fresh,
  // and let the feed jump to Recent so the new post is visible.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onPosted?.();
    }
  }, [state, onPosted]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (picked) URL.revokeObjectURL(picked.url);
    setPicked(null);
    setChosen(null);
    setLocalError(null);
    setMode(next);
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    if (picked) URL.revokeObjectURL(picked.url);
    const file = event.target.files?.[0];
    setPicked(
      file
        ? { url: URL.createObjectURL(file), name: file.name, file, at: state }
        : null,
    );
  }

  // Submit through onSubmit instead of the form `action` prop: React 19 empties
  // every field after a form action runs, which would wipe "Steer the joke"
  // (and the file) even when generation fails. Native validation still runs
  // first, and we reset the form ourselves only after a successful post.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(new FormData(event.currentTarget));
  }

  async function submit(formData: FormData) {
    if (busy.current) return;
    busy.current = true;
    setPreparing(true);
    setLocalError(null);

    try {
      // React empties the file input after a form action runs, so the photo
      // comes from our own state (this also keeps retry-after-error working).
      let image: File | null = null;

      if (mode === "library") {
        // A library pick goes through the exact same pipeline as an upload:
        // the browser loads the file and submits it as the photo, so the
        // server stores a private copy in the user's own folder (deleting the
        // post never touches the shared library file).
        if (chosenItem) {
          try {
            const response = await fetch(libraryUrl(chosenItem.file));
            if (!response.ok) throw new Error("Library image unavailable");
            const blob = await response.blob();
            image = new File([blob], chosenItem.file, { type: blob.type });
          } catch {
            setLocalError("Couldn't load that image. Try another one.");
            busy.current = false;
            return;
          }
        }
      } else if (showPreview) {
        image = picked.file;
      }

      if (!image) {
        setLocalError("Choose a photo to caption.");
        busy.current = false;
        return;
      }

      formData.set("image", await downscale(image));
      // After the awaits above we are no longer inside the form's transition,
      // so re-enter one for useActionState (keeps isPending and state correct).
      startTransition(() => formAction(formData));
    } finally {
      setPreparing(false);
    }
  }

  const error = localError ?? state?.error;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Drop a photo. Get the joke.
        </h2>
        <p className="mt-1 text-sm text-muted">
          {hasLibrary
            ? "Upload your own, or pick one from our library."
            : "A photo is all it takes."}
        </p>
      </div>

      {hasLibrary && (
        <div
          role="group"
          aria-label="Where should the photo come from?"
          className="inline-flex self-start rounded-full border border-line bg-surface p-1"
        >
          {(
            [
              ["upload", "Upload photo"],
              ["library", "Choose a photo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              aria-pressed={mode === value}
              className={`min-h-9 rounded-full px-4 text-sm ${
                mode === value
                  ? "bg-tint font-semibold text-accent-text"
                  : "font-medium text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "upload" ? (
        /* Photo picker. The real file input sits invisibly over the whole
           area, so click, tap, keyboard and form validation all behave
           natively. */
        <div className="relative">
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!showPreview}
            onChange={onPick}
            aria-label="Photo (JPEG, PNG, or WebP)"
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          {showPreview ? (
            <div className="rounded-[20px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-glow">
              <div
                className={`overflow-hidden rounded-[20px] bg-tint-2 ${
                  pending ? "is-bending" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={picked.url}
                  alt="Your chosen photo"
                  className="max-h-72 w-full object-cover"
                />
              </div>
              {/* Ghost of the caption plate: same shape the result will have. */}
              <div className="bend-plate relative mx-3 -mt-8 border border-dashed border-glow/60 bg-tint/90 px-5 py-4 pr-12 text-sm font-medium text-accent-text">
                {pending ? "Finding the joke…" : "Your caption lands here"}
                <span className="mt-1 block truncate text-xs font-normal text-muted">
                  {picked.name} · tap to change
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-glow/50 bg-tint px-4 py-8 text-center peer-hover:border-glow peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-glow">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8 text-accent-text"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1-1.5h6.6l1 1.5h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                <circle cx="12" cy="12.5" r="3.5" />
              </svg>
              <span className="text-base font-semibold">Choose a photo</span>
              <span className="text-xs text-muted">JPEG, PNG, or WebP</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {chosenItem && (
            <div>
              <div
                className={`overflow-hidden rounded-[20px] bg-tint-2 ${
                  pending ? "is-bending" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={libraryUrl(chosenItem.file)}
                  alt={chosenItem.title}
                  className="max-h-72 w-full object-cover"
                />
              </div>
              <div className="bend-plate relative mx-3 -mt-8 border border-dashed border-glow/60 bg-tint/90 px-5 py-4 pr-12 text-sm font-medium text-accent-text">
                {pending ? "Finding the joke…" : "Your caption lands here"}
                <span className="mt-1 block truncate text-xs font-normal text-muted">
                  {chosenItem.title}
                </span>
              </div>
            </div>
          )}

          <ul
            aria-label="Photo library"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {library.map((item) => {
              const selected = chosenItem?.file === item.file;
              return (
                <li key={item.file}>
                  <button
                    type="button"
                    onClick={() => setChosen({ item, at: state })}
                    aria-pressed={selected}
                    aria-label={item.title}
                    title={item.title}
                    className={`press relative block aspect-square w-full overflow-hidden rounded-2xl bg-tint-2 ${
                      selected
                        ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                        : "hover:opacity-90"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={libraryUrl(item.file)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-on-accent"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {!chosenItem && (
            <p className="text-sm text-muted">Pick an image to caption.</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          Steer the joke{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="prompt"
          name="prompt"
          maxLength={200}
          placeholder="roast this · make it dramatic · focus on the guy in the background"
          className="field"
        />
      </div>

      {state?.ok && !showPreview && !chosenItem && (
        <p
          role="status"
          className="rounded-xl bg-tint px-3 py-2 text-sm font-medium text-accent-text"
        >
          Posted! Your caption is at the top of Recent.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || preparing || (mode === "library" && !chosenItem)}
        className="btn-primary press w-full sm:w-auto sm:self-end"
      >
        {pending || preparing ? "Finding the joke…" : "Generate"}
      </button>
    </form>
  );
}
