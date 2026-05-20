import Link from "next/link";

export default function WebcamPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-slate-900">
              🌊 Webcam Kerbrise
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Vue en direct depuis Rothéneuf
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Retour
          </Link>
        </div>

        {/* Webcam card */}
        <div className="overflow-hidden rounded-3xl bg-black shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />

              <span className="text-sm font-medium tracking-wide">
                LIVE
              </span>
            </div>

            <span className="text-xs text-slate-400">
              Google Nest
            </span>
          </div>

          <div className="relative w-full">
            <div className="relative w-full pb-[56.25%]">
              <iframe
                src="https://video.nest.com/embedded/live/7sEyKZsVBd?autoplay=1"
                frameBorder="0"
                allowFullScreen
                loading="lazy"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-sm text-slate-500">
          Les vagues bretonnes ne prennent jamais de RTT 🌬️
        </p>
      </div>
    </main>
  );
}