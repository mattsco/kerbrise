import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Calendar from "@/components/Calendar";
import BackButton from "@/components/BackButton";

export default async function CalendrierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("family_id, is_family_head, is_calendar_admin, families(name)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // @ts-ignore
  const familyName: string = profile.families?.name ?? "?";

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id, start_date, end_date, status, family_id,
      families(name, color)
    `
    )
    .in("status", ["pending", "approved"])
    .order("start_date");

  const events =
    bookings?.map((b: any) => ({
      id: b.id,
      bookingId: b.id,
      start_date: b.start_date,
      end_date: b.end_date,
      family_id: b.family_id,
      family_name: b.families?.name ?? "?",
      color: b.families?.color ?? "#888",
      status: b.status as "pending" | "approved",
    })) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
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
          <p className="text-xs text-slate-500 mb-4">
            💡 Touche un jour pour commencer une sélection, puis touche un
            second jour pour créer une demande. Touche une réservation pour
            voir les détails.
            {profile.is_calendar_admin && (
              <span className="block mt-1 text-purple-700">
                🛡️ Mode admin actif : tu peux modifier ou supprimer n'importe quel séjour.
              </span>
            )}
          </p>
          <Calendar
            events={events}
            currentUserId={user.id}
            currentFamilyId={profile.family_id}
            currentFamilyName={familyName}
            isFamilyHead={profile.is_family_head}
            isCalendarAdmin={profile.is_calendar_admin ?? false}
          />
        </div>
      </div>
    </div>
  );
}