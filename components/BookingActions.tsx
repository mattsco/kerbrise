"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  adminUpdateBooking,
  adminDeleteBooking,
} from "@/app/dashboard/admin/actions";

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  onActionComplete?: () => void;
  isAdminMode?: boolean; // ← nouveau
};

export default function BookingActions({
  bookingId,
  startDate,
  endDate,
  status,
  onActionComplete,
  isAdminMode = false,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "editing" | "cancelling" | "deleting">("idle");
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
        ...(isAdminMode ? { is_admin_created: true } : {}),
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
    if (diffDays > 60 && !isAdminMode) {
      setError(`La durée maximum est de 60 jours (${diffDays} demandés).`);
      return;
    }

    // Pas de check "minimum demain" en mode admin (on peut corriger l'historique)
    if (!isAdminMode) {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (new Date(newStart) < tomorrow) {
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

    setMode("idle");
    setComment("");
    setSubmitting(false);
    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  async function handleDelete() {
    setSubmitting(true);
    setError("");

    const result = await adminDeleteBooking(bookingId);
    if (!result.success) {
      setError("Erreur : " + (result.error ?? "inconnue"));
      setSubmitting(false);
      return;
    }

    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  // ----- MODE EDITING -----
  if (mode === "editing") {
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
            ✅ Tu réduis ton séjour à l'intérieur de la période actuelle.
            <strong> Les validations déjà reçues restent valides</strong> —
            pas besoin de revoter pour les chefs qui ont déjà approuvé.
          </div>
        )}

        {!isAdminMode && isExtensionOrShift && (
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

  // ----- MODE CANCELLING -----
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
          {status === "approved" && !isAdminMode && (
            <p className="mt-1 text-xs text-slate-500">
              Sera transmis dans l'email aux 3 chefs de famille.
            </p>
          )}
          {isAdminMode && (
            <p className="mt-1 text-xs text-purple-700">
              🛡️ Mode admin : aucun email ne sera envoyé.
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

  // ----- MODE DELETING (admin only) -----
  if (mode === "deleting") {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
          ⚠️ <strong>Suppression définitive.</strong>
          <p className="mt-1 text-xs">
            Le séjour sera effacé de la base. Cette action est <strong>irréversible</strong>.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-700 text-white py-2 text-sm font-medium hover:bg-red-800 disabled:opacity-50"
          >
            {submitting ? "..." : "🗑️ Supprimer définitivement"}
          </button>
          <button
            onClick={() => {
              setMode("idle");
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

  // ----- MODE IDLE -----
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
      {isAdminMode && (
        <div className="text-xs text-purple-700 bg-purple-50 border border-purple-100 p-2 rounded-lg flex items-center gap-2">
          <span>🛡️</span>
          <span><strong>Mode admin actif</strong> · aucun email ne sera envoyé</span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setMode("editing")}
          disabled={submitting}
          className="flex-1 min-w-[120px] rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-50"
        >
          ✏️ Modifier les dates
        </button>
        <button
          onClick={() => setMode("cancelling")}
          disabled={submitting}
          className="flex-1 min-w-[120px] rounded-lg border border-red-300 text-red-700 py-2 text-sm font-medium hover:bg-red-50"
        >
          🚫 Annuler
        </button>
        {isAdminMode && (
          <button
            onClick={() => setMode("deleting")}
            disabled={submitting}
            className="flex-1 min-w-[120px] rounded-lg border border-red-500 bg-red-50 text-red-800 py-2 text-sm font-medium hover:bg-red-100"
          >
            🗑️ Supprimer
          </button>
        )}
      </div>
    </div>
  );
}