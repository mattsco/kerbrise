import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell from "@/components/offline/OfflineShell";
import OfflineProfil from "@/components/offline/OfflineProfil";

/**
 * Profil hors ligne — miroir partiel de /dashboard/profil (spec #37).
 *
 * « Partiel » assumé : seuls la famille et ce qui s'en déduit par calcul pur
 * sont disponibles. Le nom d'affichage, l'e-mail, les compteurs de séjours et
 * le changement de mot de passe demandent le réseau — cf. OfflineProfil.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneProfilPage() {
  await requireAuthUser();

  return (
    <OfflineShell title="Mon profil" backHref="/hors-ligne">
      <OfflineProfil />
    </OfflineShell>
  );
}
