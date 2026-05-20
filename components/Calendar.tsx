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

// Formate une Date en YYYY-MM-DD en utilisant les composants locaux
// (évite le bug UTC de toISOString())
function dateToLocalString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
    // react-big-calendar : end est exclusif (un drag d'un jour donne end = jour+1)
    // On utilise la conversion locale pour éviter les décalages UTC
    const startStr = dateToLocalString(slotInfo.start);
    
    // Pour end : on retire 1 jour pour avoir une date inclusive
    const endInclusive = new Date(slotInfo.end);
    endInclusive.setDate(endInclusive.getDate() - 1);
    const endStr = dateToLocalString(endInclusive);

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