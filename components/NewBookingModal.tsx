"use client";

import { useRouter } from "next/navigation";
import NewBookingForm from "./NewBookingForm";
import AdminBookingForm from "./AdminBookingForm";

type Props = {
  familyId: string;
  familyName: string;
  userId: string;
  initialStart?: string;
  initialEnd?: string;
  isCalendarAdmin?: boolean;
  onClose: () => void;
};

export default function NewBookingModal({
  familyId,
  familyName,
  userId,
  initialStart,
  initialEnd,
  isCalendarAdmin = false,
  onClose,
}: Props) {
  const router = useRouter();

  function handleSuccess() {
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isCalendarAdmin ? "🛡️ Nouveau séjour (admin)" : "Nouvelle demande"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          {isCalendarAdmin ? (
            <AdminBookingForm
              initialStart={initialStart}
              initialEnd={initialEnd}
              onSuccess={handleSuccess}
            />
          ) : (
            <NewBookingForm
              familyId={familyId}
              familyName={familyName}
              userId={userId}
              initialStart={initialStart}
              initialEnd={initialEnd}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
