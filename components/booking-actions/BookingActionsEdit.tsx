"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { adminUpdateBooking } from "@/app/dashboard/admin/actions";
import { validateBookingDates } from "@/lib/validation/booking";
import { useBookingMutation } from "./useBookingMutation";

type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

type Family = { id: string; name: string; color: string };
type UserRow = { id: string; display_name: string | null; family_id: string };

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  familyId: string;
  createdBy: string;
  isAdminMode: boolean;
  onComplete: () => void;
  onBack: () => void;
};

export default function BookingActionsEdit({
  bookingId,
  startDate,
  endDate,
  status,
  familyId,
  createdBy,
  isAdminMode,
  onComplete,
  onBack,
}: Props) {
  const [newStart, setNewStart] = useState(startDate);
  const [newEnd, setNewEnd] = useState(endDate);
  const [comment, setComment] = useState("");
  const { submitting, error, setError, run } = useBookingMutation();

  // ── État spécifique mode admin ───────────────────────────────────────────
  const [newStatus, setNewStatus] = useState<BookingStatus>(status);
  const [newFamilyId, setNewFamilyId] = useState(familyId);
  const [newCreatedBy, setNewCreatedBy] = useState(createdBy);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  // En mode admin, on charge familles + membres pour la réassignation.
  useEffect(() => {
    if (!isAdminMode) return;
    const supabase = createClient();
    supabase
      .from("families")
      .select("id, name, color")
      .then(({ data }) => setFamilies(data ?? []));
    supabase
      .from("users")
      .select("id, display_name, family_id")
      .then(({ data }) => setUsers(data ?? []));
  }, [isAdminMode]);

  // Si on change la famille, on s'assure que le créateur appartient à la famille.
  const usersOfFamily = users.filter((u) => u.family_id === newFamilyId);
  useEffect(() => {
    if (!isAdminMode || usersOfFamily.length === 0) return;
    if (!usersOfFamily.some((u) => u.id === newCreatedBy)) {
      setNewCreatedBy(usersOfFamily[0].id);
    }
  }, [newFamilyId, users]); // eslint-disable-line react-hooks/exhaustive-deps

  const isReductionOnly =
    newStart >= startDate &&
    newEnd <= endDate &&
    (newStart !== startDate || newEnd !== endDate);

  const isExtensionOrShift =
    (newStart < startDate || newEnd > endDate) &&
    (newStart !== startDate || newEnd !== endDate);

  async function handleSave() {
    setError("");

    const validation = validateBookingDates(newStart, newEnd, {
      isAdminMode,
      originalStart: startDate,
    });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    await run(
      async () => {
        if (isAdminMode) {
          const result = await adminUpdateBooking(bookingId, newStart, newEnd, {
            status: newStatus !== status ? newStatus : null,
            familyId: newFamilyId !== familyId ? newFamilyId : null,
            createdBy: newCreatedBy !== createdBy ? newCreatedBy : null,
            reason: reason || null,
            notify,
          });
          return result.success
            ? { ok: true }
            : { ok: false, error: result.error ?? "inconnue" };
        }

        // Mode normal : update direct côté client (RLS gère les droits)
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

        return updateError
          ? { ok: false, error: updateError.message }
          : { ok: true };
      },
      () => {
        setComment("");
        setReason("");
        onComplete();
      }
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      {isAdminMode && (
        <div className="text-xs text-purple-700 bg-purple-50 border border-purple-100 p-2 rounded-lg">
          🛡️ Mode admin : tu pilotes le statut à la main. Les votes ne sont pas
          réinitialisés. Email envoyé uniquement si tu coches l&apos;option.
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

      {/* ── Options admin : statut, réassignation, raison, email ── */}
      {isAdminMode && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Statut
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="approved">Approuvé</option>
              <option value="pending">En attente</option>
              <option value="rejected">Refusé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Famille
              </label>
              <select
                value={newFamilyId}
                onChange={(e) => setNewFamilyId(e.target.value)}
                disabled={submitting || families.length === 0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Créateur
              </label>
              <select
                value={newCreatedBy}
                onChange={(e) => setNewCreatedBy(e.target.value)}
                disabled={submitting || usersOfFamily.length === 0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {usersOfFamily.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name ?? "?"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Raison (journal admin, optionnel)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="Ex: correction d'une erreur de saisie"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={submitting}
              className="rounded border-slate-300"
            />
            Envoyer un email aux familles concernées
          </label>
        </>
      )}

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
