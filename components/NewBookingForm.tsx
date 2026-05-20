"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  familyId: string;
  userId: string;
  initialStart?: string;
  initialEnd?: string;
  onSuccess?: () => void;
};

type AdjacentBooking = {
  id: string;
  start_date: string;
  end_date: string;
  family_name: string;
  family_color: string;
};

export default function NewBookingForm({
  familyId,
  userId,
  initialStart = "",
  initialEnd = "",
  onSuccess,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [adjacent, setAdjacent] = useState<AdjacentBooking[]>([]);

  // Fetch séjours connectés à ±7 jours quand les dates sont saisies
  useEffect(() => {
    async function fetchAdjacent() {
      if (!start || !end) {
        setAdjacent([]);
        return;
      }

      const startDate = new Date(start);
      const endDate = new Date(end);
      const before = new Date(startDate);
      before.setDate(before.getDate() - 7);
      const after = new Date(endDate);
      after.setDate(after.getDate() + 7);

      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("id, start_date, end_date, families(name, color)")
        .in("status", ["pending", "approved"])
        .gte("end_date", before.toISOString().split("T")[0])
        .lte("start_date", after.toISOString().split("T")[0])
        .order("start_date");

      if (data) {
        const mapped = data
          .map((b: any) => ({
            id: b.id,
            start_date: b.start_date,
            end_date: b.end_date,
            family_name: b.families?.name ?? "?",
            family_color: b.families?.color ?? "#888",
          }))
          // Exclut les séjours qui se chevauchent strictement
          // (on garde ceux à ±7 jours qui sont juste avant/après)
          .filter((b) => {
            const bStart = new Date(b.start_date);
            const bEnd = new Date(b.end_date);
            // Adjacent = totalement avant ou totalement après (pivot OK)
            return bEnd <= startDate || bStart >= endDate;
          });
        setAdjacent(mapped);
      }
    }

    fetchAdjacent();
  }, [start, end]);

  async function handleSubmit() {
    setError("");

    if (!start || !end) {
      setError("Les deux dates sont requises.");
      return;
    }

    if (new Date(end) < new Date(start)) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    const diffDays = Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (diffDays > 60) {
      setError(`La durée maximum est de 60 jours (${diffDays} demandés).`);
      return;
    }

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (new Date(start) < tomorrow) {
      setError("La date de début doit être au moins demain.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const { error: insertError } = await supabase.from("bookings").insert({
      family_id: familyId,
      created_by: userId,
      start_date: start,
      end_date: end,
      note: note.trim() || null,
      status: "pending",
    });

    if (insertError) {
      setError("Erreur : " + insertError.message);
      setSubmitting(false);
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/dashboard/demande-envoyee");
    }
  }

  function formatShort(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  }

  function daysBetween(date1: string, date2: string) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diff = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  const before = adjacent.filter(
    (b) => start && new Date(b.end_date) <= new Date(start)
  );
  const after = adjacent.filter(
    (b) => end && new Date(b.start_date) >= new Date(end)
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Date d'arrivée
        </label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Date de départ
        </label>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
          placeholder="Ex: Vacances de Noël en famille"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Section "séjours connectés" */}
      {(before.length > 0 || after.length > 0) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-900 uppercase">
            🏠 Séjours connectés (±7 jours)
          </p>
          {before.map((b) => {
            const gap = start ? daysBetween(b.end_date, start) : 0;
            return (
              <div key={b.id} className="text-xs text-slate-700 flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: b.family_color }}
                />
                <strong>{b.family_name}</strong> · du{" "}
                {formatShort(b.start_date)} au {formatShort(b.end_date)}
                <span className="text-slate-500">
                  ({gap === 0 ? "même jour" : `${gap}j avant`})
                </span>
              </div>
            );
          })}
          {after.map((b) => {
            const gap = end ? daysBetween(b.start_date, end) : 0;
            return (
              <div key={b.id} className="text-xs text-slate-700 flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: b.family_color }}
                />
                <strong>{b.family_name}</strong> · du{" "}
                {formatShort(b.start_date)} au {formatShort(b.end_date)}
                <span className="text-slate-500">
                  ({gap === 0 ? "même jour" : `${gap}j après`})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "Envoi..." : "Envoyer la demande"}
      </button>
    </div>
  );
}