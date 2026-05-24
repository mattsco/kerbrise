"use client";
import { parseLocalDate, dateToISO } from "@/lib/dates";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ApprovalButtons from "./ApprovalButtons";
import BookingActions from "./BookingActions";
import { FAMILY_NAMES, getFamilyColor } from "@/lib/families";

type Props = {
  bookingId: string;
  currentUserId: string;
  currentFamilyId: string;
  isFamilyHead: boolean;
  isCalendarAdmin?: boolean; // ← nouveau
  onClose: () => void;
};

type BookingDetail = {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  family_id: string;
  created_by: string;
  family_name: string;
  family_color: string;
  author_name: string;
  approvals: Array<{
    id: string;
    family_id: string;
    family_name: string;
    family_color: string;
    decision: "approved" | "rejected";
    decided_by_name: string;
  }>;
  adjacent: Array<{
    id: string;
    start_date: string;
    end_date: string;
    family_name: string;
    family_color: string;
  }>;
};


export default function BookingDetailModal({
  bookingId,
  currentUserId,
  currentFamilyId,
  isFamilyHead,
  isCalendarAdmin = false,
  onClose,
}: Props) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooking() {
      const supabase = createClient();

      const { data: b } = await supabase
        .from("bookings")
        .select(
          `
          id, start_date, end_date, note, status, family_id, created_by,
          families(name, color),
          users:created_by(display_name)
        `
        )
        .eq("id", bookingId)
        .single();

      if (!b) {
        setLoading(false);
        return;
      }

      const { data: approvals } = await supabase
        .from("approvals")
        .select(
          `
          id, family_id, decision,
          families(name, color),
          users:decided_by(display_name)
        `
        )
        .eq("booking_id", bookingId);

      const startDate = parseLocalDate(b.start_date);
      const endDate = parseLocalDate(b.end_date);
      const before = new Date(startDate);
      before.setDate(before.getDate() - 7);
      const after = new Date(endDate);
      after.setDate(after.getDate() + 7);

      const { data: adj } = await supabase
        .from("bookings")
        .select("id, start_date, end_date, families(name, color)")
        .in("status", ["pending", "approved"])
        .neq("id", bookingId)
        .gte("end_date", dateToISO(before))
        .lte("start_date", dateToISO(after))   
        .order("start_date");

      const adjacent = (adj ?? [])
        .map((a: any) => ({
          id: a.id,
          start_date: a.start_date,
          end_date: a.end_date,
          family_name: a.families?.name ?? "?",
          family_color: a.families?.color ?? "#888",
        }))
        .filter((a) => {
          const aStart = parseLocalDate(a.start_date);
          const aEnd = parseLocalDate(a.end_date);
          return aEnd <= startDate || aStart >= endDate;
        });

      setBooking({
        id: b.id,
        start_date: b.start_date,
        end_date: b.end_date,
        note: b.note,
        status: b.status,
        family_id: b.family_id,
        created_by: b.created_by,
        // @ts-ignore
        family_name: b.families?.name ?? "?",
        // @ts-ignore
        family_color: b.families?.color ?? "#888",
        // @ts-ignore
        author_name: b.users?.display_name ?? "?",
        approvals: (approvals ?? []).map((a: any) => ({
          id: a.id,
          family_id: a.family_id,
          family_name: a.families?.name ?? "?",
          family_color: a.families?.color ?? "#888",
          decision: a.decision,
          decided_by_name: a.users?.display_name ?? "?",
        })),
        adjacent,
      });
      setLoading(false);
    }

    fetchBooking();
  }, [bookingId]);

  function formatDate(iso: string) {
    return parseLocalDate(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatShort(iso: string) {
    return parseLocalDate(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6">Chargement...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6">
          <p>Réservation introuvable.</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const isAuthor = booking.created_by === currentUserId;
  const canApprove =
    isFamilyHead &&
    booking.status === "pending" &&
    booking.family_id !== currentFamilyId &&
    !booking.approvals.some((a) => a.family_id === currentFamilyId);

  // Actions normales si auteur ET séjour non finalisé
  const canEditOrCancelNormal =
    isAuthor && (booking.status === "pending" || booking.status === "approved");

  // Actions admin si calendar admin + booking non cancelled/rejected
  const canEditOrCancelAdmin =
    isCalendarAdmin &&
    !isAuthor && // si auteur, on garde le mode normal
    (booking.status === "pending" || booking.status === "approved");

  // Mode admin actif : si admin ET (pas auteur OU séjour cancelled/rejected)
  const showAdminActions =
    isCalendarAdmin &&
    (canEditOrCancelAdmin ||
      (isCalendarAdmin && !canEditOrCancelNormal && booking.status !== "cancelled"));

  // Sections affichées uniquement pour les statuts non-finaux
  const showValidations = booking.status === "pending";
  const showAdjacent =
    booking.status === "pending" && booking.adjacent.length > 0;

  const statusBadge =
    booking.status === "pending"
      ? { text: "⏳ En attente", color: "bg-amber-100 text-amber-800" }
      : booking.status === "approved"
      ? { text: "✅ Approuvée", color: "bg-emerald-100 text-emerald-800" }
      : booking.status === "rejected"
      ? { text: "❌ Refusée", color: "bg-red-100 text-red-800" }
      : { text: "🚫 Annulée", color: "bg-slate-100 text-slate-700" };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between">
          <div>
            <span
              className="inline-block px-3 py-1 rounded-full text-white text-xs font-medium mb-1"
              style={{ backgroundColor: booking.family_color }}
            >
              {booking.family_name}
            </span>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ml-1 ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="font-medium text-slate-900">
              Du {formatDate(booking.start_date)}
            </p>
            <p className="font-medium text-slate-900">
              au {formatDate(booking.end_date)}
            </p>
          </div>

          <div className="text-sm text-slate-600">
            <p>
              Demandé par <strong>{booking.author_name}</strong>
            </p>
            {booking.note && (
              <p className="mt-1 text-slate-700">📝 {booking.note}</p>
            )}
          </div>

          {/* Validations - SEULEMENT pour pending */}
          {showValidations && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Validations
              </p>
              <div className="space-y-1.5 text-sm">

{FAMILY_NAMES.map((famName) => {
                  const isAuthorFam = booking.family_name === famName;
                  const approval = booking.approvals.find(
                    (a) => a.family_name === famName
                  );
                  return (
                    <div key={famName} className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: getFamilyColor(famName) }}
                      />
                      <strong>{famName}</strong>
                      {isAuthorFam ? (
                        <span className="text-slate-500">🏠 (auteur)</span>
                      ) : approval?.decision === "approved" ? (
                        <span className="text-emerald-600">✅ Approuvé</span>
                      ) : approval?.decision === "rejected" ? (
                        <span className="text-red-600">❌ Refusé</span>
                      ) : (
                        <span className="text-slate-500">⏳ En attente</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Séjours connectés - SEULEMENT pour pending */}
          {showAdjacent && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-blue-900 uppercase">
                🏠 Séjours connectés (±7 jours)
              </p>
              {booking.adjacent.map((a) => (
                <div key={a.id} className="text-xs text-slate-700 flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: a.family_color }}
                  />
                  <strong>{a.family_name}</strong> · du{" "}
                  {formatShort(a.start_date)} au {formatShort(a.end_date)}
                </div>
              ))}
            </div>
          )}

          {/* Actions chef (sauf si admin agit comme admin) */}
          {canApprove && !isCalendarAdmin && (
            <ApprovalButtons
              bookingId={booking.id}
              familyId={currentFamilyId}
              userId={currentUserId}
              onActionComplete={onClose}
            />
          )}

          {/* Actions auteur (mode normal) ou actions admin (mode admin) */}
          
{/* Si admin → toujours mode admin (priorité sur le mode auteur) */}
          {isCalendarAdmin && booking.status !== "cancelled" && (
            <BookingActions
              bookingId={booking.id}
              startDate={booking.start_date}
              endDate={booking.end_date}
              status={booking.status as "pending" | "approved" | "rejected"}
              onActionComplete={onClose}
              isAdminMode
            />
          )}

          {/* Si pas admin et auteur → mode normal */}
          {!isCalendarAdmin && canEditOrCancelNormal && (
            <BookingActions
              bookingId={booking.id}
              startDate={booking.start_date}
              endDate={booking.end_date}
              status={booking.status as "pending" | "approved" | "rejected"}
              onActionComplete={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function familyColor(name: string): string {
  if (name === "Antoine") return "#3b82f6";
  if (name === "François") return "#10b981";
  if (name === "Vincent") return "#f59e0b";
  return "#888";
}