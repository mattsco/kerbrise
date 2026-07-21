import { requireAuthUser } from "@/lib/supabase/auth";
import OfflineShell from "@/components/offline/OfflineShell";
import TeleGuide from "@/components/tele/TeleGuide";

/**
 * Guide de la télé hors ligne — miroir de /dashboard/a-propos/tele (#37).
 *
 * Contenu identique à la version en ligne (composant partagé), à deux détails
 * près gérés par `offline` : images servies depuis /_next/static (donc
 * précachées) et vidéo de démonstration remplacée par une note.
 */
export const dynamic = "force-dynamic";

export default async function HorsLigneTelePage() {
  await requireAuthUser();

  return (
    <OfflineShell
      title="📺 La nouvelle télé"
      subtitle="Comment l'utiliser, et les quelques pièges à connaître."
      backHref="/hors-ligne/a-propos"
    >
      <TeleGuide offline />
    </OfflineShell>
  );
}
