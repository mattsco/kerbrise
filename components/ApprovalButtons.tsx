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

  async function handleDecision(decision: "approved" | "rejected") {
    if (submitting) return;
    
    const label = decision === "approved" ? "approuver" : "refuser";
    if (!confirm(`Confirmer : ${label} cette demande ?`)) return;

    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("approvals").insert({
      booking_id: bookingId,
      family_id: familyId,
      decision,
      decided_by: userId,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex gap-2">
        <button
          onClick={() => handleDecision("approved")}
          disabled={submitting}
          className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {submitting ? "..." : "✅ Approuver"}
        </button>
        <button
          onClick={() => handleDecision("rejected")}
          disabled={submitting}
          className="flex-1 rounded-lg bg-red-600 text-white py-2.5 font-medium hover:bg-red-700 disabled:opacity-50 transition"
        >
          {submitting ? "..." : "❌ Refuser"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}