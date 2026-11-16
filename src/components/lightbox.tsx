"use client";

import { useRef } from "react";
import { Icon } from "./icons";

// Click a photo to see it large. Uses the native <dialog>: focus is trapped,
// Escape closes it, and clicking the backdrop closes it too.
export function Lightbox({ src, alt, children, className = "" }: { src: string; alt: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={`group relative block w-full cursor-zoom-in ${className}`} aria-label={`Enlarge photo: ${alt}`}>
        {children}
        <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="expand" />
        </span>
      </button>
      <dialog
        ref={ref}
        className="lightbox"
        aria-label={alt}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[88vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl" />
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="absolute -right-2 -top-2 grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow-lg">
            <Icon name="x" />
          </button>
        </div>
      </dialog>
    </>
  );
}
