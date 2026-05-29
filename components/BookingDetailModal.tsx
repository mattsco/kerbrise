"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ApprovalButtons from "./ApprovalButtons";
import BookingActions from "./BookingActions";
import { FAMILY_NAMES, getFamilyColor } from "@/lib/families";
import { getBookingDetail } from "@/lib/data/bookings";
import type { BookingDetail } from "@/lib/data/types";
import { STATUS_BADGES, formatLong, formatShort } from "@/lib/ui/booking-display";

type Props = {
  bookingId: string;
  currentUserId: string;
  currentFamilyId: string;
  isFamilyHead: boolean;
  isCalendarAdmin?: boolean; 
  onClose: () => void;
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
    let ignore = false;
    const supabase = createClient();

    getBookingDetail(supabase, bookingId).then((detail) => {
      if (ignore) return;
      setBooking(detail);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [bookingId]);

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

  // Sections affichées uniquement pour les statuts non-finaux
  const showValidations = booking.status === "pending";
  const showAdjacent =
    booking.status === "pending" && booking.adjacent.length > 0;

  const statusBadge = STATUS_BADGES[booking.status];

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
              {statusBadge.label}
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
              Du {formatLong(booking.start_date)}
            </p>
            <p className="font-medium text-slate-900">
              au {formatLong(booking.end_date)}
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
