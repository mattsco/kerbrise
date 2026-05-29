"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";

type Props = {
  bookingId: string;
  familyId: string;
  userId: string;
  onActionComplete?: () => void;
};

export default function ApprovalButtons({
  bookingId,
  familyId,
  userId,
  onActionComplete,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [comment, setComment] = useState("");

  async function handleApprove() {
    if (!confirm("Confirmer : approuver cette demande ?")) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("approvals").insert({
      booking_id: bookingId,
      family_id: familyId,
      decision: "approved",
      decided_by: userId,
    });

    if (insertError) {
      // Si cette approbation est la dernière et fait basculer le séjour en
      // "approved", le trigger DB peut buter sur la contrainte anti-overlap
      // (bookings_no_overlap_when_approved) : une autre famille a déjà un
      // séjour approuvé sur ces dates. On traduit le message Postgres brut.
      const isOverlapConstraint =
        /no_overlap|exclusion constraint|conflicting key/i.test(
          insertError.message
        );

      setError(
        isOverlapConstraint
          ? "Impossible d'approuver : ces dates chevauchent un séjour déjà approuvé par une autre famille. Le calendrier a peut-être changé depuis l'envoi de la demande."
          : insertError.message
      );
      setSubmitting(false);
      return;
    }

    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  async function handleReject() {
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("approvals").insert({
      booking_id: bookingId,
      family_id: familyId,
      decision: "rejected",
      decided_by: userId,
      comment: comment.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setMode("idle");
    setComment("");
    router.refresh();
    if (onActionComplete) onActionComplete();
  }

  // Mode "je suis en train de refuser, je rédige éventuellement un mot"
  if (mode === "rejecting") {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Un mot à l'auteur ? <span className="text-slate-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="Ex: On voulait prendre cette semaine, on peut s'en parler au téléphone ?"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="mt-1 text-xs text-slate-500">
            Sera transmis dans l'email à l'auteur.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setMode("idle");
              setComment("");
              setError("");
            }}
            disabled={submitting}
            className="flex-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 py-2 text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            {submitting ? "..." : "Confirmer le refus"}
          </button>
        </div>
      </div>
    );
  }

  // Mode "idle" : approuver en avant, refuser discret
  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-medium disabled:opacity-50 transition shadow-sm"
        >
          <Check className="w-4 h-4" />
          {submitting ? "..." : "Approuver"}
        </button>
        <button
          onClick={() => setMode("rejecting")}
          disabled={submitting}
          className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
        >
          Refuser
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}