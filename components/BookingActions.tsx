"use client";

import { useState } from "react";
import BookingActionsIdle from "./booking-actions/BookingActionsIdle";
import BookingActionsEdit from "./booking-actions/BookingActionsEdit";
import BookingActionsCancel from "./booking-actions/BookingActionsCancel";
import BookingActionsDelete from "./booking-actions/BookingActionsDelete";

type Mode = "idle" | "editing" | "cancelling" | "deleting";

type Props = {
  bookingId: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  onActionComplete?: () => void;
  isAdminMode?: boolean;
};

export default function BookingActions({
  bookingId,
  startDate,
  endDate,
  status,
  onActionComplete,
  isAdminMode = false,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");

  function handleComplete() {
    setMode("idle");
    if (onActionComplete) onActionComplete();
  }

  function handleBack() {
    setMode("idle");
  }

  if (mode === "editing") {
    return (
      <BookingActionsEdit
        bookingId={bookingId}
        startDate={startDate}
        endDate={endDate}
        isAdminMode={isAdminMode}
        onComplete={handleComplete}
        onBack={handleBack}
      />
    );
  }

  if (mode === "cancelling") {
    return (
      <BookingActionsCancel
        bookingId={bookingId}
        status={status}
        isAdminMode={isAdminMode}
        onComplete={handleComplete}
        onBack={handleBack}
      />
    );
  }

  if (mode === "deleting") {
    return (
      <BookingActionsDelete
        bookingId={bookingId}
        onComplete={handleComplete}
        onBack={handleBack}
      />
    );
  }

  return (
    <BookingActionsIdle
      isAdminMode={isAdminMode}
      onEdit={() => setMode("editing")}
      onCancel={() => setMode("cancelling")}
      onDelete={() => setMode("deleting")}
    />
  );
}