"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bookingId: string;
  status: "pending" | "approved" | "rejected";
  isAdminMode: boolean;
  onComplete: () => void;
  onBack: () => void;
};

export default function BookingActionsCancel({
  bookingId,
  status,
  isAdminMode,
  onComplete,
  onBack,
}: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    onComplete();
  }

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
            Sera transmis dans l&apos;email aux 3 chefs de famille.
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
          onClick={onBack}
          disabled={submitting}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Retour
        </button>
      </div>
    </div>
  );
}