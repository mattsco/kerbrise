import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ApprovalButtons from "@/components/ApprovalButtons";

export const dynamic = "force-dynamic";

type BookingWithApprovals = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  family_id: string;
  created_at: string;
  families: { name: string; color: string } | null;
  users: { display_name: string | null } | null;
  approvals: {
    family_id: string;
    decision: "approved" | "rejected";
    families: { name: string; color: string } | null;
  }[];
};

export default async function PendingBookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, family_id, is_family_head, families(name, color)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const isFamilyHead =
    (profile as { is_family_head?: boolean }).is_family_head ?? false;

  // Récupère toutes les demandes en attente avec leurs approbations
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, start_date, end_date, note, family_id, created_at,
      families(name, color),
      users:created_by(display_name),
      approvals(family_id, decision, families(name, color))
    `)
    .eq("status", "pending")
    .order("start_date");

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-red-600">Erreur : {error.message}</p>
      </main>
    );
  }

  const allBookings = (bookings ?? []) as unknown as BookingWithApprovals[];

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 underline">
            ← Tableau de bord
          </Link>
          <h1 className="text-2xl font-light mt-1">Demandes en attente</h1>
          <p className="text-sm text-slate-500 mt-1">
            {allBookings.length} demande{allBookings.length > 1 ? "s" : ""}{" "}
            en attente de validation
          </p>
        </header>

        {allBookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-slate-500">
            🎉 Aucune demande en attente !
          </div>
        ) : (
          <div className="space-y-4">
            {allBookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                currentUserId={user.id}
                currentUserFamilyId={profile.family_id}
                isFamilyHead={isFamilyHead}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function BookingCard({
  booking,
  currentUserId,
  currentUserFamilyId,
  isFamilyHead,
}: {
  booking: BookingWithApprovals;
  currentUserId: string;
  currentUserFamilyId: string;
  isFamilyHead: boolean;
}) {
  const familyName = booking.families?.name ?? "?";
  const familyColor = booking.families?.color ?? "#888";
  const createdBy = booking.users?.display_name ?? "?";

  const isMyFamily = booking.family_id === currentUserFamilyId;
  const myFamilyApproval = booking.approvals.find(
    (a) => a.family_id === currentUserFamilyId
  );

  // Le chef peut décider seulement si :
  // - C'est PAS sa famille
  // - Sa famille n'a pas encore décidé
  const canDecide = isFamilyHead && !isMyFamily && !myFamilyApproval;

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block px-2 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: familyColor }}
            >
              {familyName}
            </span>
            {isMyFamily && (
              <span className="text-xs text-slate-400">(votre famille)</span>
            )}
          </div>
          <p className="text-base font-medium">
            Du {formatDate(booking.start_date)} au {formatDate(booking.end_date)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Demandé par {createdBy}
            {booking.note && ` · ${booking.note}`}
          </p>
        </div>
      </div>

      {/* État des approbations */}
      <div className="border-t border-slate-100 pt-3 mt-3 space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
          Validations
        </p>
        <ApprovalStatus
          familyName={familyName}
          color={familyColor}
          decision="self"
          isOwn
        />
        {["Antoine", "François", "Vincent"]
          .filter((name) => name !== familyName)
          .map((otherFamily) => {
            const approval = booking.approvals.find(
              (a) => a.families?.name === otherFamily
            );
            return (
              <ApprovalStatus
                key={otherFamily}
                familyName={otherFamily}
                color={approval?.families?.color ?? familyColorFor(otherFamily)}
                decision={approval?.decision ?? null}
              />
            );
          })}
      </div>

      {/* Boutons d'action */}
      {canDecide && (
        <ApprovalButtons
          bookingId={booking.id}
          familyId={currentUserFamilyId}
          userId={currentUserId}
        />
      )}

      {!isFamilyHead && !isMyFamily && (
        <p className="mt-3 text-xs text-slate-400 italic">
          Seuls les chefs de famille peuvent approuver.
        </p>
      )}
    </div>
  );
}

function ApprovalStatus({
  familyName,
  color,
  decision,
  isOwn,
}: {
  familyName: string;
  color: string;
  decision: "approved" | "rejected" | "self" | null;
  isOwn?: boolean;
}) {
  let label = "";
  let labelColor = "text-slate-400";

  if (isOwn) {
    label = "🏠 (auteur)";
  } else if (decision === "approved") {
    label = "✅ Approuvé";
    labelColor = "text-emerald-600";
  } else if (decision === "rejected") {
    label = "❌ Refusé";
    labelColor = "text-red-600";
  } else {
    label = "⏳ En attente";
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-medium text-slate-700">{familyName}</span>
      <span className={labelColor}>{label}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

function familyColorFor(name: string): string {
  if (name === "Antoine") return "#3b82f6";
  if (name === "François") return "#10b981";
  if (name === "Vincent") return "#f59e0b";
  return "#888";
}