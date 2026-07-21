import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell, { OfflineNavCard } from "@/components/offline/OfflineShell";
import NextCollections from "@/app/dashboard/a-propos/NextCollections";

/**
 * « À propos » hors ligne — miroir de /dashboard/a-propos (spec #37).
 *
 * Les poubelles réutilisent le composant en ligne tel quel : il est déjà
 * client et purement calculé (lib/garbage-collection.ts), donc il fonctionne
 * sans réseau sans qu'on ait à le dupliquer.
 *
 * Le mot de passe wifi, les numéros utiles et les contacts figés arrivent à
 * l'étape 4 — avec le déplacement de la constante depuis MaisonStatus.tsx
 * vers lib/config.ts.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneAProposPage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="🏡 À propos de la maison"
      subtitle="Ce qui reste consultable sans réseau."
      backHref="/hors-ligne"
    >
      <NextCollections />

      <OfflineNavCard
        href="/hors-ligne/a-propos/regles"
        emoji="📜"
        title="Règles d'occupation"
        description="Priorités et périodes d'été"
        accent="bg-amber-50"
      />

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          Indisponible hors ligne
        </p>
        <ul className="text-xs text-slate-400 space-y-1">
          {/* La carte Freebox mesure le réseau : hors ligne, elle n'aurait
              rien à dire — c'est cohérent, pas une lacune. */}
          <li>Statut de la Freebox</li>
          <li>Mode d&apos;emploi de la télé</li>
        </ul>
      </div>
    </OfflineShell>
  );
}
