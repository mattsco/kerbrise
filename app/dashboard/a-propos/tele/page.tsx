import BackButton from "@/components/BackButton";
import TeleGuide from "@/components/tele/TeleGuide";

export const metadata = {
  title: "La nouvelle télé — Kerbrise",
};

/**
 * Guide d'utilisation de la télé Philips du salon : prise en main + pièges
 * connus. Page de contenu statique (pas de données), au même format que
 * a-propos/regles. Lisible par tous (dont les moins à l'aise avec la tech) :
 * phrases courtes, pas de jargon.
 *
 * Le contenu vit dans `components/tele/TeleGuide.tsx`, partagé avec la version
 * hors ligne (#37) pour qu'il n'y ait jamais deux guides à corriger.
 */
export default function TelePhilipsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton href="/dashboard/a-propos" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            📺 La nouvelle télé
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comment l&apos;utiliser, et les quelques pièges à connaître.
          </p>
        </div>

        <TeleGuide />
      </div>
    </main>
  );
}
