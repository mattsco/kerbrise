import { createClient } from "@/lib/supabase/server";

async function FamiliesFooter() {
  const supabase = await createClient();
  const { data: families, error } = await supabase
    .from("families")
    .select("name")
    .order("name");

  if (error) {
    console.error("Supabase error:", error);
    return (
      <footer className="text-center text-xs uppercase tracking-[0.25em] text-red-400">
        Erreur Supabase
      </footer>
    );
  }

  const names =
    families && families.length > 0
      ? families.map((f) => f.name).join(" · ")
      : "Aucune famille";

  return (
    <footer className="text-center text-xs uppercase tracking-[0.25em] text-white/60">
      {names}
    </footer>
  );
}

export default async function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Image de fond */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://kerbrise.fr/sunset.jpg?auto=format&fit=crop&w=1600&q=80')",
        }}
      />

      {/* Voile dégradé pour la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />

      {/* Contenu */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-12 text-white">
        {/* Header */}
        <header className="w-full text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">
            Saint-Malo · Rothéneuf
          </p>
        </header>

        {/* Bloc central */}
        <div className="flex flex-col items-center text-center">
          <h1 className="text-6xl font-light tracking-tight drop-shadow-lg sm:text-7xl">
            Kerbrise
          </h1>
          <div className="mx-auto mt-4 h-px w-16 bg-white/60" />
          <p className="mt-6 max-w-xs text-lg font-light leading-relaxed text-white/90">
            La maison familiale du Val,
            <br />à deux pas de la plage.
          </p>
          <a
            href="/login"
            className="mt-10 rounded-full border border-white/40 bg-white/10 px-8 py-3 text-sm font-medium tracking-wide backdrop-blur-sm transition hover:bg-white/20"
          >
            Se connecter
          </a>

      
          <p className="mt-3 text-xs text-white/60">Bientôt disponible</p>
        </div>

        {/* Footer dynamique depuis Supabase */}
        <FamiliesFooter />
      </div>
    </main>
  );
}