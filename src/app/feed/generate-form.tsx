"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { generateCaption, type GenerateFormState } from "./actions";

const MAX_DIMENSION = 1600;

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

export function GenerateForm() {
  const [state, formAction, pending] = useActionState<
    GenerateFormState,
    FormData
  >(generateCaption, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Local preview of the chosen photo. `at` remembers which action result was
  // current when it was picked, so a successful generation clears the preview
  // without needing an effect that sets state.
  const [picked, setPicked] = useState<{
    url: string;
    name: string;
    at: GenerateFormState;
  } | null>(null);
  const showPreview = picked && !(state?.ok && picked.at !== state);

  // After a successful post, empty the form so the next photo starts fresh.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    if (picked) URL.revokeObjectURL(picked.url);
    const file = event.target.files?.[0];
    setPicked(
      file
        ? { url: URL.createObjectURL(file), name: file.name, at: state }
        : null,
    );
  }

  async function submit(formData: FormData) {
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      formData.set("image", await downscale(image));
    }
    // After the await above we are no longer inside the form's transition, so
    // re-enter one for useActionState (keeps isPending and state correct).
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Drop a photo. Get the joke.
        </h2>
        <p className="mt-1 text-sm text-muted">
          A photo is all it takes.
        </p>
      </div>

      {/* Photo picker. The real file input sits invisibly over the whole area,
          so click, tap, keyboard and form validation all behave natively. */}
      <div className="relative">
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
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

      {state?.error && (
        <p
          role="alert"
          className="rounded-xl bg-coral-tint px-3 py-2 text-sm text-coral-text"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary press w-full sm:w-auto sm:self-end"
      >
        {pending ? "Finding the joke…" : "Generate"}
      </button>
    </form>
  );
}
