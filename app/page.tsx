import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Photo sunset en fond plein écran */}
      <img
        src="/sunset.jpg"
        alt="Kerbrise au coucher du soleil"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay très subtil pour lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

      {/* Contenu */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Localisation en haut */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pt-14">
          Saint-Malo · Rothéneuf
        </p>

        {/* Bloc central : Kerbrise + sous-titre + bouton */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-40">
          <h1 className="text-6xl sm:text-7xl font-light text-white tracking-tight drop-shadow-lg">
            Kerbrise
          </h1>
          <div className="w-16 h-px bg-white/60 my-5" />
          <p className="text-white/90 text-base mb-10 drop-shadow">
            La maison familiale du Val
          </p>
          <Link
            href="/login"
            className="inline-block px-10 py-3.5 rounded-full bg-white/90 text-slate-900 font-medium hover:bg-white transition shadow-lg backdrop-blur-sm"
          >
            Se connecter
          </Link>
        </div>

        {/* Noms en bas */}
        <p className="text-center text-white/80 text-xs tracking-[0.3em] uppercase pb-12">
          Antoine · François · Vincent
        </p>
      </div>
    </main>
  );
}