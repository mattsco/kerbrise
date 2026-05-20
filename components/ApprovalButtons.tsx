"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bookingId: string;
  familyId: string;
  userId: string;
};

export default function ApprovalButtons({
  bookingId,
  familyId,
  userId,
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
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.refresh();
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
  }

  if (mode === "rejecting") {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Message à l'auteur (optionnel)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="Ex: On voulait prendre cette semaine, on peut s'en parler au téléphone ?"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <p className="mt-1 text-xs text-slate-500">
            Sera transmis dans l'email à l'auteur de la demande.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "..." : "Confirmer le refus"}
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
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "..." : "✅ Approuver"}
        </button>
        <button
          onClick={() => setMode("rejecting")}
          disabled={submitting}
          className="flex-1 rounded-lg bg-red-600 text-white py-2.5 font-medium hover:bg-red-700 disabled:opacity-50"
        >
          ❌ Refuser
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}