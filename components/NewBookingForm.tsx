"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ApprovedBooking = {
  start_date: string;
  end_date: string;
  family_id: string;
  families: { name: string } | null;
};

type Props = {
  familyId: string;
  userId: string;
  approvedBookings: ApprovedBooking[];
};

export default function NewBookingForm({
  familyId,
  userId,
  approvedBookings,
}: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dates min/max pour les input
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  function validate(): string | null {
    if (!startDate || !endDate) return "Indique une date de début et de fin.";

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) return "La date de fin doit être après la date de début.";

    // Min 1 jour à l'avance
    const tomorrowDate = new Date();
    tomorrowDate.setHours(0, 0, 0, 0);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    if (start < tomorrowDate)
      return "La date de début doit être au moins demain.";

    // Max 60 jours
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 60)
      return `La durée maximum est de 60 jours (tu as demandé ${diffDays} jours).`;

    // Anti-chevauchement avec les approuvées
    const conflict = approvedBookings.find((b) => {
      const bStart = new Date(b.start_date);
      const bEnd = new Date(b.end_date);
      return start <= bEnd && end >= bStart;
    });
    if (conflict) {
      const famName = conflict.families?.name ?? "?";
      return `Conflit : la famille ${famName} a déjà réservé du ${formatDate(
        conflict.start_date
      )} au ${formatDate(conflict.end_date)}.`;
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("bookings").insert({
      family_id: familyId,
      created_by: userId,
      start_date: startDate,
      end_date: endDate,
      status: "pending",
      note: note.trim() || null,
    });

    if (insertError) {
      setError("Erreur : " + insertError.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard/demande-envoyee");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Arrivée
        </label>
        <input
          type="date"
          required
          min={minDate}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Départ (jour du départ au matin)
        </label>
        <input
          type="date"
          required
          min={startDate || minDate}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Note (optionnel)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          rows={2}
          placeholder="Ex : vacances scolaires, anniversaire..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        💡 Ta demande sera envoyée aux 2 autres familles pour validation.
        Elle sera confirmée si les deux donnent leur accord.
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {submitting ? "Envoi..." : "Envoyer la demande"}
      </button>
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}