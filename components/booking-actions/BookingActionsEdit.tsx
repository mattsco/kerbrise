"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminUpdateBooking } from "@/app/dashboard/admin/actions";
import { daysBetween, dateToISO } from "@/lib/dates";

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  isAdminMode: boolean;
  onComplete: () => void;
  onBack: () => void;
};

export default function BookingActionsEdit({
  bookingId,
  startDate,
  endDate,
  isAdminMode,
  onComplete,
  onBack,
}: Props) {
  const router = useRouter();
  const [newStart, setNewStart] = useState(startDate);
  const [newEnd, setNewEnd] = useState(endDate);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isReductionOnly =
    newStart >= startDate &&
    newEnd <= endDate &&
    (newStart !== startDate || newEnd !== endDate);

  const isExtensionOrShift =
    (newStart < startDate || newEnd > endDate) &&
    (newStart !== startDate || newEnd !== endDate);

  async function handleSave() {
    setError("");

    if (!newStart || !newEnd) {
      setError("Les deux dates sont requises.");
      return;
    }

    if (newEnd < newStart) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    const diffDays = daysBetween(newStart, newEnd);
    if (diffDays > 60 && !isAdminMode) {
      setError(`La durée maximum est de 60 jours (${diffDays} demandés).`);
      return;
    }

    // Pas de check "minimum demain" en mode admin (on peut corriger l'historique)
    if (!isAdminMode) {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (newStart < dateToISO(tomorrow)) {
        setError("La date de début doit être au moins demain.");
        return;
      }
    }

    setSubmitting(true);

    if (isAdminMode) {
      // Mode admin : passe par la server action qui set is_admin_created + bypass triggers
      const result = await adminUpdateBooking(bookingId, newStart, newEnd);
      if (!result.success) {
        setError("Erreur : " + (result.error ?? "inconnue"));
        setSubmitting(false);
        return;
      }
    } else {
      // Mode normal : update direct côté client (RLS s'occupe des droits)
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          start_date: newStart,
          end_date: newEnd,
          last_action_type: isReductionOnly ? "reduced" : "modified",
          last_action_comment: comment.trim() || null,
        })
        .eq("id", bookingId);

      if (updateError) {
        setError("Erreur : " + updateError.message);
        setSubmitting(false);
        return;
      }
    }

    setComment("");
    setSubmitting(false);
    router.refresh();
    onComplete();
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      {isAdminMode && (
        <div className="text-xs text-purple-700 bg-purple-50 border border-purple-100 p-2 rounded-lg">
          🛡️ Mode admin : aucun email ne sera envoyé.
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Arrivée
        </label>
        <input
          type="date"
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Départ
        </label>
        <input
          type="date"
          value={newEnd}
          onChange={(e) => setNewEnd(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>
      {!isAdminMode && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Message (optionnel)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            rows={2}
            placeholder={
              isReductionOnly
                ? "Ex: On a finalement raccourci notre séjour."
                : "Ex: On a dû ajuster nos dates de vacances."
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      )}

      {!isAdminMode && isReductionOnly && (
        <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg">
          ✅ Tu réduis ton séjour à l&apos;intérieur de la période actuelle.
          <strong> Les validations déjà reçues restent valides</strong> — pas
          besoin de revoter pour les chefs qui ont déjà approuvé.
        </div>
      )}

      {!isAdminMode && isExtensionOrShift && (
        <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
          ⚠️ Tu modifies les dates en dehors de la période actuelle. Les
          validations précédentes seront <strong>annulées</strong> et la demande
          repassera en attente de validation par les deux autres familles.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={submitting}
          className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "..." : "Enregistrer"}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}