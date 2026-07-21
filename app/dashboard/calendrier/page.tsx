import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/supabase/auth";
import { getCalendarBookings } from "@/lib/data/bookings";
import Calendar from "@/components/Calendar";
import BackButton from "@/components/BackButton";
import SnapshotWriter from "@/components/offline/SnapshotWriter";

export default async function CalendrierPage() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("family_id, is_family_head, is_calendar_admin, families(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Profil incomplet → on laisse Next gérer (impossible en pratique avec requireAuthUser)
    return null;
  }

  // @ts-ignore
  const familyName: string = profile.families?.name ?? "?";

  // Fetch tous les chefs de MA famille (sauf moi), pour l'UX du modal d'été
  const { data: heads } = await supabase
    .from("users")
    .select("display_name")
    .eq("family_id", profile.family_id)
    .eq("is_family_head", true)
    .neq("id", user.id);

  const familyHeadNames: string[] = (heads ?? [])
    .map((h: any) => h.display_name)
    .filter(Boolean);

  // Data layer : une seule source pour la query bookings + le mapping.
  const events = await getCalendarBookings(supabase);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl md:max-w-[1800px] mx-auto p-4 sm:p-6">
        <BackButton />
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">
          Calendrier
          {profile.is_calendar_admin && (
            <span className="ml-2 text-xs sm:text-sm font-normal text-purple-700 bg-purple-100 px-2 py-1 rounded-full align-middle">
              🛡️ Admin
            </span>
          )}
        </h1>
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-xs text-slate-500 mb-4 md:hidden">
            💡 Touche un jour pour commencer une sélection, puis touche un
            second jour pour créer une demande. Touche une réservation pour
            voir les détails.
            {profile.is_calendar_admin && (
              <span className="block mt-1 text-purple-700">
                🛡️ Mode admin actif : tu peux modifier ou supprimer n&apos;importe quel séjour.
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 mb-4 hidden md:block">
            💡 Clique un jour pour commencer une sélection, puis un second
            pour créer une demande. Clique une réservation pour voir les
            détails, ou une famille dans la légende pour filtrer.
            {profile.is_calendar_admin && (
              <span className="block mt-1 text-purple-700">
                🛡️ Mode admin actif : tu peux modifier ou supprimer n&apos;importe quel séjour.
              </span>
            )}
          </p>
          <Calendar
            events={events}
            currentUserId={user.id}
            currentFamilyId={profile.family_id}
            currentFamilyName={familyName}
            isFamilyHead={profile.is_family_head}
            familyHeadNames={familyHeadNames}
            isCalendarAdmin={profile.is_calendar_admin ?? false}
          />
        </div>

        {/* Recopie le calendrier pour le mode hors ligne (#37). Aucune
            requête : il réutilise `events`, déjà chargé ci-dessus. */}
        <SnapshotWriter bookings={events} familyName={familyName} />
      </div>
    </div>
  );
}
