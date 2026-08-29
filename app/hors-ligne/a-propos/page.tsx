import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell, {
  OfflineActionCard,
} from "@/components/offline/OfflineShell";
import OfflineWifi from "@/components/offline/OfflineWifi";
import NextCollections from "@/app/dashboard/a-propos/NextCollections";
import LinksContactsSection from "@/app/dashboard/a-propos/LinksContactsSection";

/**
 * « À propos » hors ligne — miroir de /dashboard/a-propos (spec #37).
 *
 * Deux composants de l'app sont réutilisés TELS QUELS plutôt que recopiés :
 *   - `NextCollections` : déjà client et purement calculé
 *     (supabase/functions/_shared/garbage-collection.ts), donc il fonctionne sans réseau.
 *   - `LinksContactsSection` : données figées dans le code, aucun appel.
 *
 * Les liens externes qu'il contient (Google Docs) échoueront évidemment sans
 * réseau — mais les numéros de téléphone, eux, restent composables, et c'est
 * précisément ce dont on a besoin pendant une panne.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneAProposPage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="🏡 À propos de la maison"
      subtitle="Infos, liens et contacts utiles de Kerbrise."
      backHref="/hors-ligne"
    >
      <OfflineActionCard
        href="/hors-ligne/a-propos/regles"
        icon={<span className="text-lg">📜</span>}
        iconBg="bg-amber-50"
        title="Règles d'occupation"
        desc="Priorités, périodes été, et conventions familiales"
      />

      <OfflineWifi />

      <NextCollections />

      <LinksContactsSection />

      <OfflineActionCard
        href="/hors-ligne/a-propos/tele"
        icon={<span className="text-lg">📺</span>}
        iconBg="bg-sky-50"
        title="La nouvelle télé"
        desc="Mode d'emploi et pièges à connaître"
      />
    </OfflineShell>
  );
}
