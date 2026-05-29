"use client";

import { adminDeleteBooking } from "@/app/dashboard/admin/actions";
import { useBookingMutation } from "./useBookingMutation";

type Props = {
  bookingId: string;
  onComplete: () => void;
  onBack: () => void;
};

export default function BookingActionsDelete({
  bookingId,
  onComplete,
  onBack,
}: Props) {
  const { submitting, error, run } = useBookingMutation();

  async function handleDelete() {
    await run(async () => {
      const result = await adminDeleteBooking(bookingId);
      return result.success
        ? { ok: true }
        : { ok: false, error: result.error ?? "inconnue" };
    }, onComplete);
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
        ⚠️ <strong>Suppression définitive.</strong>
        <p className="mt-1 text-xs">
          Le séjour sera effacé de la base. Cette action est{" "}
          <strong>irréversible</strong>.
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
