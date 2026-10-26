export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 pb-24 pt-6"
    >
      <p role="status" className="sr-only">
        Loading the feed…
      </p>
      <div className="h-80 glass rounded-3xl motion-safe:animate-pulse" />
      <div>
        <div className="aspect-[4/3] rounded-[22px] bg-tint-2 motion-safe:animate-pulse" />
        <div className="bend-plate plate-glass relative mx-3 -mt-10 h-24 motion-safe:animate-pulse" />
      </div>
    </main>
  );
}
