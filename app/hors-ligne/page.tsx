import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell, { OfflineNavCard } from "@/components/offline/OfflineShell";
import OfflineTides from "@/components/offline/OfflineTides";

/**
 * Hub hors ligne — le « dashboard sans réseau » (spec #37, décision 12).
 *
 * Calque l'architecture en ligne : les conditions du jour sont visibles sans
 * clic, comme le dashboard affiche sa bannière ; le reste vit derrière les
 * mêmes sections qu'en ligne. Pendant une panne, on ne veut pas fouiller.
 *
 * Protégée par l'auth comme le reste de l'app (décision 6) : le SW ne
 * l'installe qu'une fois l'utilisateur connecté, donc le fetch de précache
 * porte les cookies de session.
 */

// L'auth rend déjà la page dynamique ; on l'explicite pour que personne ne la
// rende statique par inadvertance en touchant au contenu.
export const dynamic = "force-dynamic";

export default async function HorsLignePage() {
  await requireAuthUser();

  return (
    <OfflineShell title="Kerbrise">
      <OfflineTides />

      <OfflineNavCard
        href="/hors-ligne/a-propos"
        emoji="🏡"
        title="À propos de la maison"
        description="Poubelles, infos et contacts utiles"
        accent="bg-emerald-50"
      />

      <OfflineNavCard
        href="/hors-ligne/a-propos/regles"
        emoji="📜"
        title="Règles d'occupation"
        description="Priorités et périodes d'été"
        accent="bg-amber-50"
      />

      {/* Les sections impossibles hors ligne sont annoncées plutôt que
          silencieusement absentes — on explique, on ne laisse pas croire à un
          bug (décision 5). Le calendrier rejoindra les vraies cartes à
          l'étape 3, une fois le snapshot en place. */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          Indisponible hors ligne
        </p>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>Calendrier et demandes de séjour</li>
          <li>Votes et approbations</li>
          <li>Webcam et statut de la Freebox</li>
          <li>Statistiques</li>
        </ul>
      </div>
    </OfflineShell>
  );
}
