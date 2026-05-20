import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Calendar from "@/components/Calendar";

// Parse "YYYY-MM-DD" en Date locale (pas UTC)
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
    .select("family_id, is_family_head")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id, start_date, end_date, status, note,
      families(name, color)
    `
    )
    .in("status", ["pending", "approved"])
    .order("start_date");

  const events =
    bookings?.map((b: any) => {
      // Parse en local pour éviter le décalage UTC
      const start = parseLocalDate(b.start_date);
      // end exclusive pour react-big-calendar : on ajoute 1 jour
      const end = parseLocalDate(b.end_date);
      end.setDate(end.getDate() + 1);
      return {
        id: b.id,
        title: `${b.families?.name ?? "?"}${b.status === "pending" ? " (en attente)" : ""}`,
        start,
        end,
        resource: {
          bookingId: b.id,
          familyName: b.families?.name ?? "?",
          color: b.families?.color ?? "#888",
          status: b.status,
        },
      };
    }) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <Link
          href="/dashboard"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Tableau de bord
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">
          Calendrier
        </h1>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-3">
            💡 Sélectionne une plage de dates pour créer une demande, ou
            touche une réservation pour voir les détails.
          </p>
          <Calendar
            events={events}
            currentUserId={user.id}
            currentFamilyId={profile.family_id}
            isFamilyHead={profile.is_family_head}
          />
        </div>
      </div>
    </div>
  );
}