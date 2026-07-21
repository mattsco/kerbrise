import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell from "@/components/offline/OfflineShell";
import OfflineSummer from "@/components/offline/OfflineSummer";

/**
 * « Règles d'occupation » hors ligne — miroir de
 * /dashboard/a-propos/regles (spec #37).
 *
 * Tout est dérivé de lib/summer-priorities.ts (pur, et le code le plus testé
 * du repo depuis #34) : rotation, dates de périodes, ordre de priorité.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneReglesPage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="📜 Règles d'occupation"
      subtitle="Priorités et périodes d'été, recalculées sans réseau."
      backHref="/hors-ligne/a-propos"
    >
      <OfflineSummer />
    </OfflineShell>
  );
}
