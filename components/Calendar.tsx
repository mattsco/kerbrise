"use client";

import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { fr };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: fr }),
  getDay,
  locales,
});

export type BookingEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  familyName: string;
  familyColor: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

type Props = {
  events: BookingEvent[];
};

export default function KerbriseCalendar({ events }: Props) {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={["month", "week", "agenda"]}
        style={{ height: "70vh" }}
        culture="fr"
        messages={{
          next: "Suivant",
          previous: "Précédent",
          today: "Aujourd'hui",
          month: "Mois",
          week: "Semaine",
          day: "Jour",
          agenda: "Liste",
          date: "Date",
          time: "Heure",
          event: "Réservation",
          noEventsInRange: "Aucune réservation sur cette période",
          showMore: (total) => `+ ${total} autres`,
        }}
        eventPropGetter={(event: BookingEvent) => {
          const isApproved = event.status === "approved";
          return {
            style: {
              backgroundColor: event.familyColor,
              opacity: isApproved ? 1 : 0.5,
              border: isApproved ? "none" : `2px dashed ${event.familyColor}`,
              color: "white",
              borderRadius: "4px",
              fontSize: "0.85rem",
            },
          };
        }}
      />
    </div>
  );
}