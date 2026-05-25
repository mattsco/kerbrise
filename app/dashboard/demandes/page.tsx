import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ApprovalButtons from "@/components/ApprovalButtons";
import BookingActions from "@/components/BookingActions";
import { FAMILY_NAMES, getFamilyColor } from "@/lib/families";
import BackButton from "@/components/BackButton";
import { isStayActiveOrFuture } from "@/lib/dates";
import { requireAuthUser } from "@/lib/supabase/auth";


export const dynamic = "force-dynamic";

type BookingWithApprovals = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  family_id: string;
  created_by: string;
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
  const user = await requireAuthUser();
  const supabase = await createClient(); 

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, family_id, is_family_head, is_calendar_admin, families(name, color)")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/dashboard");

  const isFamilyHead =
    (profile as { is_family_head?: boolean }).is_family_head ?? false;
  const isCalendarAdmin =
    (profile as { is_calendar_admin?: boolean }).is_calendar_admin ?? false;

  // Récupère TOUS les bookings non rejetés/annulés (pending + approved)
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, start_date, end_date, note, status, family_id, created_by, created_at,
      families(name, color),
      users:created_by(display_name),
      approvals(family_id, decision, families(name, color))
    `)
    .in("status", ["pending", "approved"])
    .order("start_date");

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-red-600">Erreur : {error.message}</p>
      </main>
    );
  }

  const allBookings = (bookings ?? []) as unknown as BookingWithApprovals[];

  // Filtrage par sections
  const toValidate = allBookings.filter(
    (b) =>
      b.status === "pending" &&
      b.family_id !== profile.family_id &&
      !b.approvals.some((a) => a.family_id === profile.family_id)
  );

  // Section "Demandes de ma famille" : on n'affiche que les séjours
  // actifs / futurs / terminés depuis ≤ 2 jours.
  // L'admin calendrier voit tout son historique de famille.
  const myFamilyBookings = allBookings.filter((b) => {
    if (b.family_id !== profile.family_id) return false;
    if (isCalendarAdmin) return true;
    return isStayActiveOrFuture(b.end_date, 2);
  });

  const otherPending = allBookings.filter(
    (b) =>
      b.status === "pending" &&
      b.family_id !== profile.family_id &&
      !toValidate.some((t) => t.id === b.id)
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <BackButton />
          <h1 className="text-2xl font-light mt-1">Demandes</h1>
        </header>

        {/* SECTION 1 : à valider (chefs seulement) */}
        {isFamilyHead && toValidate.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wide font-medium text-amber-700 mb-3">
              ⚠️ À ta décision ({toValidate.length})
            </h2>
            <div className="space-y-3">
              {toValidate.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  currentUserId={user.id}
                  currentUserFamilyId={profile.family_id}
                  isFamilyHead={isFamilyHead}
                  showApprovalButtons
                />
              ))}
            </div>
          </section>
        )}

        {/* SECTION 2 : demandes de MA famille */}
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wide font-medium text-slate-500 mb-3">
            🏠 Demandes de ma famille
            {isCalendarAdmin && (
              <span className="ml-2 text-purple-600 font-normal normal-case">
                (mode admin : historique complet)
              </span>
            )}
          </h2>
          {myFamilyBookings.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-6 text-center text-slate-500 text-sm">
              Aucune demande active.
              <br />
              <Link
                href="/dashboard/nouvelle-demande"
                className="text-slate-900 underline mt-2 inline-block"
              >
                Créer une demande
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myFamilyBookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  currentUserId={user.id}
                  currentUserFamilyId={profile.family_id}
                  isFamilyHead={isFamilyHead}
                  isOwnFamily
                />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3 : autres demandes en attente (lecture seule) */}
        {otherPending.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wide font-medium text-slate-500 mb-3">
              📋 Autres demandes en cours ({otherPending.length})
            </h2>
            <div className="space-y-3">
              {otherPending.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  currentUserId={user.id}
                  currentUserFamilyId={profile.family_id}
                  isFamilyHead={isFamilyHead}
                />
              ))}
            </div>
          </section>
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
  showApprovalButtons,
  isOwnFamily,
}: {
  booking: BookingWithApprovals;
  currentUserId: string;
  currentUserFamilyId: string;
  isFamilyHead: boolean;
  showApprovalButtons?: boolean;
  isOwnFamily?: boolean;
}) {
  const familyName = booking.families?.name ?? "?";
  const familyColor = booking.families?.color ?? "#888";
  const createdBy = booking.users?.display_name ?? "?";
  const isAuthor = booking.created_by === currentUserId;

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-white text-xs"
            style={{ backgroundColor: familyColor }}
          >
            {familyName}
          </span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-base font-medium">
          Du {formatDate(booking.start_date)} au {formatDate(booking.end_date)}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Demandé par {createdBy}
          {booking.note && ` · ${booking.note}`}
        </p>
      </div>

      {/* État des approbations */}
      {booking.status === "pending" && (
        <div className="border-t border-slate-100 pt-3 mt-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
            Validations
          </p>

{FAMILY_NAMES.map((fam) => {
            if (fam === familyName) {
              return (
                <ApprovalStatus
                  key={fam}
                  familyName={fam}
                  color={familyColor}
                  decision="self"
                />
              );
            }
            const approval = booking.approvals.find(
              (a) => a.families?.name === fam
            );
            return (
              <ApprovalStatus
                key={fam}
                familyName={fam}
                color={approval?.families?.color ?? getFamilyColor(fam)}
                decision={approval?.decision ?? null}
              />
            );
          })}
        </div>
      )}

      {/* Boutons d'approbation pour les chefs */}
      {showApprovalButtons && (
        <ApprovalButtons
          bookingId={booking.id}
          familyId={currentUserFamilyId}
          userId={currentUserId}
        />
      )}

      {/* Boutons d'action pour ma famille (annuler/modifier) */}
      {isOwnFamily && isAuthor && booking.status !== "cancelled" && (
        <BookingActions
          bookingId={booking.id}
          startDate={booking.start_date}
          endDate={booking.end_date}
          status={booking.status}
        />
      )}

      {isOwnFamily && !isAuthor && (
        <p className="mt-3 text-xs text-slate-400 italic">
          Seul {createdBy} (auteur) peut modifier ou annuler cette demande.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BookingWithApprovals["status"] }) {
  const config = {
    pending: { label: "⏳ En attente", color: "bg-amber-100 text-amber-800" },
    approved: { label: "✅ Approuvée", color: "bg-emerald-100 text-emerald-800" },
    rejected: { label: "❌ Refusée", color: "bg-red-100 text-red-800" },
    cancelled: { label: "🚫 Annulée", color: "bg-slate-100 text-slate-600" },
  };
  const c = config[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${c.color}`}>
      {c.label}
    </span>
  );
}

function ApprovalStatus({
  familyName,
  color,
  decision,
}: {
  familyName: string;
  color: string;
  decision: "approved" | "rejected" | "self" | null;
}) {
  let label = "";
  let labelColor = "text-slate-400";

  if (decision === "self") {
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
    year: "numeric",
  });
}

