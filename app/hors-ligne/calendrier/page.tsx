import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell from "@/components/offline/OfflineShell";
import OfflineCalendar from "@/components/offline/OfflineCalendar";

/**
 * Calendrier hors ligne — miroir de /dashboard/calendrier (spec #37).
 *
 * Le contenu vient du snapshot applicatif écrit en ligne (SnapshotWriter),
 * jamais d'un cache HTTP de réponses Supabase.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneCalendrierPage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="Calendrier"
      subtitle="Dernière copie connue des séjours."
      backHref="/hors-ligne"
    >
      <OfflineCalendar />
    </OfflineShell>
  );
}
