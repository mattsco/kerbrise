"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved";
};

export default function BookingActions({
  bookingId,
  startDate,
  endDate,
  status,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "editing">("idle");
  const [newStart, setNewStart] = useState(startDate);
  const [newEnd, setNewEnd] = useState(endDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (!confirm("Es-tu sûr de vouloir annuler cette demande ? Cette action est irréversible.")) return;
    
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (updateError) {
      setError("Erreur : " + updateError.message);
      setSubmitting(false);
      return;
    }

    router.refresh();
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

    if (status === "approved") {
      if (!confirm(
        "Modifier les dates va annuler les approbations en cours. La demande devra être à nouveau validée. Continuer ?"
      )) return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ start_date: newStart, end_date: newEnd })
      .eq("id", bookingId);

    if (updateError) {
      setError("Erreur : " + updateError.message);
      setSubmitting(false);
      return;
    }

    setMode("idle");
    setSubmitting(false);
    router.refresh();
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
              setError("");
            }}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
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
        className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        ✏️ Modifier les dates
      </button>
      <button
        onClick={handleCancel}
        disabled={submitting}
        className="flex-1 rounded-lg border border-red-300 text-red-700 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
      >
        🚫 Annuler
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}