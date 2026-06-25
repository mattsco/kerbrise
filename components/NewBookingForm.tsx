"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { daysBetween } from "@/lib/dates";
import { overlapsSummerPeriod } from "@/lib/summer-priorities";
import { getRelatedBookings, createBookingRequest } from "@/lib/data/bookings";
import type { RelatedBooking } from "@/lib/data/types";
import { validateBookingDates } from "@/lib/validation/booking";
import { formatShort } from "@/lib/ui/booking-display";

type Props = {
  familyId: string;
  userId: string;
  initialStart?: string;
  initialEnd?: string;
  onSuccess?: () => void;
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
  const [adjacent, setAdjacent] = useState<RelatedBooking[]>([]);
  const [overlapping, setOverlapping] = useState<RelatedBooking[]>([]);

  // Fetch séjours autour des dates (adjacents ET en conflit) via data layer
  useEffect(() => {
    let ignore = false;

    if (!start || !end) {
      setAdjacent([]);
      setOverlapping([]);
      return;
    }

    const supabase = createClient();
    getRelatedBookings(supabase, start, end).then(
      ({ adjacent: adj, overlapping: ov }) => {
        if (ignore) return;
        setAdjacent(adj);
        setOverlapping(ov);
      }
    );

    return () => {
      ignore = true;
    };
  }, [start, end]);

  // Conflit avec une période d'été fixe (juillet/août)
  const summerConflict =
    start && end ? overlapsSummerPeriod(start, end) : null;

  const hasBlocker = overlapping.length > 0 || !!summerConflict;

  async function handleSubmit() {
    setError("");

    // Validation des dates centralisée (mêmes règles qu'avant)
    const validation = validateBookingDates(start, end);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    if (summerConflict) {
      setError(
        `Cette plage chevauche la ${summerConflict.label} (${summerConflict.description}), réservée par rotation. Passe par le calendrier d'été pour réserver une période fixe.`
      );
      return;
    }

    if (overlapping.length > 0) {
      const first = overlapping[0];
      setError(
        `Cette plage chevauche un séjour ${first.family_name} (du ${formatShort(first.start_date)} au ${formatShort(first.end_date)}). Choisis d'autres dates.`
      );
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const result = await createBookingRequest(supabase, {
      familyId,
      userId,
      start,
      end,
      note: note.trim() || null,
    });

    if (!result.ok) {
      // Cas race : deux membres réservent les mêmes dates au même moment.
      // Le check advisory ci-dessus les a tous les deux laissés passer, mais la
      // contrainte DB (bookings_no_overlap_approved) bloque le perdant.
      // On traduit le message Postgres cryptique en message clair.
      const isOverlapConstraint =
        /no_overlap|exclusion constraint|conflicting key/i.test(result.error);

      setError(
        isOverlapConstraint
          ? "Ces dates viennent d'être réservées par une autre famille. Rafraîchis le calendrier et choisis d'autres dates."
          : "Erreur : " + result.error
      );
      setSubmitting(false);
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push("/dashboard/demande-envoyee");
    }
  }

  const before = adjacent.filter((b) => start && b.end_date <= start);
  const after = adjacent.filter((b) => end && b.start_date >= end);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Date d&apos;arrivée
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

      {/* Conflit période d'été */}
      {summerConflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          ⏳ <strong>{summerConflict.label}</strong> ({summerConflict.description}) est une période d&apos;été réservée par rotation. Tu ne peux pas la réserver via une demande classique — passe par le calendrier d&apos;été.
        </div>
      )}

      {/* Conflit booking existant */}
      {overlapping.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1.5 text-xs">
          <p className="font-semibold text-red-900 uppercase">
            ⚠️ Chevauchement détecté
          </p>
          {overlapping.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 text-red-900 flex-wrap"
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: b.family_color }}
              />
              <strong>{b.family_name}</strong>
              <span>
                du {formatShort(b.start_date)} au {formatShort(b.end_date)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Séjours adjacents (uniquement si pas de blocage) */}
      {(before.length > 0 || after.length > 0) && !hasBlocker && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-900 uppercase">
            🏠 Séjours connectés (±7 jours)
          </p>
          {before.map((b) => {
            const gap = start ? daysBetween(b.end_date, start) : 0;
            return (
              <div
                key={b.id}
                className="text-xs text-slate-700 flex items-center gap-2 flex-wrap"
              >
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
            const gap = end ? daysBetween(end, b.start_date) : 0;
            return (
              <div
                key={b.id}
                className="text-xs text-slate-700 flex items-center gap-2 flex-wrap"
              >
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
        disabled={submitting || hasBlocker}
        className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "Envoi..." : "Envoyer la demande"}
      </button>
    </div>
  );
}
