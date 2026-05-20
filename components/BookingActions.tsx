"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  onActionComplete?: () => void;
};

export default function BookingActions({
  bookingId,
  startDate,
  endDate,
  status,
  onActionComplete,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "editing" | "cancelling">("idle");
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

  async function handleCancel() {
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        last_action_type: "cancelled",
        last_action_comment: comment.trim() || null,
      })
      .eq("id", bookingId);

    if (updateError) {
      setError("Erreur : " + updateError.message);
      setSubmitting(false);
      return;
    }

    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  async function handleSave() {
    setError("");

    if (!newStart || !newEnd) {
      setError("Les deux dates sont requises.");
      return;
    }

    if (new Date(newEnd) < new Date(newStart)) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    const diffDays = Math.ceil(
      (new Date(newEnd).getTime() - new Date(newStart).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (diffDays > 60) {
      setError(`La durée maximum est de 60 jours (${diffDays} demandés).`);
      return;
    }

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (new Date(newStart) < tomorrow) {
      setError("La date de début doit être au moins demain.");
      return;
    }

    setSubmitting(true);
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

    setMode("idle");
    setComment("");
    setSubmitting(false);
    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  if (mode === "editing") {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
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

        {isReductionOnly && (
          <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            ✅ Tu réduis ton séjour à l'intérieur de la période actuelle.
            <strong> Les validations déjà reçues restent valides</strong> —
            pas besoin de revoter pour les chefs qui ont déjà approuvé.
          </div>
        )}

        {isExtensionOrShift && (
          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
            ⚠️ Tu modifies les dates en dehors de la période actuelle. Les
            validations précédentes seront <strong>annulées</strong> et la
            demande repassera en attente de validation par les deux autres
            familles.
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
            onClick={() => {
              setMode("idle");
              setNewStart(startDate);
              setNewEnd(endDate);
              setComment("");
              setError("");
            }}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (mode === "cancelling") {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Message aux autres familles (optionnel)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="Ex: Imprévu de dernière minute, on libère la maison."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {status === "approved" && (
            <p className="mt-1 text-xs text-slate-500">
              Sera transmis dans l'email aux 3 chefs de famille.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "..." : "Confirmer l'annulation"}
          </button>
          <button
            onClick={() => {
              setMode("idle");
              setComment("");
              setError("");
            }}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
      <button
        onClick={() => setMode("editing")}
        disabled={submitting}
        className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-50"
      >
        ✏️ Modifier les dates
      </button>
      <button
        onClick={() => setMode("cancelling")}
        disabled={submitting}
        className="flex-1 rounded-lg border border-red-300 text-red-700 py-2 text-sm font-medium hover:bg-red-50"
      >
        🚫 Annuler
      </button>
    </div>
  );
}