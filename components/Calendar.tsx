"use client";

import { useState } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import BookingDetailModal from "./BookingDetailModal";
import NewBookingModal from "./NewBookingModal";

const locales = { fr };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: fr }),
  getDay,
  locales,
});

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    bookingId: string;
    familyName: string;
    color: string;
    status: string;
  };
};

type Props = {
  events: CalendarEvent[];
  currentUserId: string;
  currentFamilyId: string;
  isFamilyHead: boolean;
};

export default function Calendar({
  events,
  currentUserId,
  currentFamilyId,
  isFamilyHead,
}: Props) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [newBookingRange, setNewBookingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  function handleSelectSlot(slotInfo: { start: Date; end: Date }) {
    // react-big-calendar utilise un end exclusive : un drag d'un jour donne
    // start = 15 et end = 16. On retire 1 jour pour avoir un end inclusive.
    const endInclusive = new Date(slotInfo.end);
    endInclusive.setDate(endInclusive.getDate() - 1);

    const startStr = slotInfo.start.toISOString().split("T")[0];
    const endStr = endInclusive.toISOString().split("T")[0];

    setNewBookingRange({ start: startStr, end: endStr });
  }

  function handleSelectEvent(event: CalendarEvent) {
    setSelectedBookingId(event.resource.bookingId);
  }

  function eventStyleGetter(event: CalendarEvent) {
    const isPending = event.resource.status === "pending";
    return {
      style: {
        backgroundColor: event.resource.color,
        opacity: isPending ? 0.65 : 1,
        borderRadius: "6px",
        color: "white",
        border: isPending ? "2px dashed white" : "none",
        fontSize: "13px",
        padding: "2px 6px",
      },
    };
  }

  return (
    <>
      <div style={{ height: "70vh" }}>
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.MONTH}
          views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          messages={{
            month: "Mois",
            week: "Semaine",
            day: "Jour",
            today: "Aujourd'hui",
            previous: "Précédent",
            next: "Suivant",
            agenda: "Liste",
            date: "Date",
            time: "Heure",
            event: "Réservation",
            noEventsInRange: "Aucune réservation sur cette période.",
            showMore: (total: number) => `+ ${total} de plus`,
          }}
          longPressThreshold={250}
        />
      </div>

      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          currentUserId={currentUserId}
          currentFamilyId={currentFamilyId}
          isFamilyHead={isFamilyHead}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {newBookingRange && (
        <NewBookingModal
          familyId={currentFamilyId}
          userId={currentUserId}
          initialStart={newBookingRange.start}
          initialEnd={newBookingRange.end}
          onClose={() => setNewBookingRange(null)}
        />
      )}
    </>
  );
}