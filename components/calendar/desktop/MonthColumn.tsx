"use client";

import DayCellDesktop from "./DayCellDesktop";

import { FRENCH_MONTHS } from "../calendar-utils";

import type { Placeholder } from "@/lib/summer-placeholders";
import type { CalendarEvent } from "../CalendarDayCell";


// Index getDay() natif : 0 = dimanche … 6 = samedi.
const WEEKDAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"] as const;

// Référence stable pour les jours vides → le memo de DayCellDesktop
// peut court-circuiter (un `?? []` créerait un nouveau tableau à chaque rendu).
const NO_EVENTS: CalendarEvent[] = [];

type Props = {
  year: number;
  monthIndex: number; // 0-11
  eventsByDate: Map<string, CalendarEvent[]>;
  placeholdersByDate: Map<string, Placeholder>;
  holidaysByDate: Map<string, string>;
  todayStr: string;
  isInSelection: (dateStr: string) => boolean;
  filterFamily: string | null;
  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;
  onDayHover: (dateStr: string) => void;
};

/**
 * Une colonne mois de la grille année (#31) : en-tête + exactement 31
 * emplacements jour, pour que le jour N de chaque mois soit aligné
 * horizontalement sur toute l'année (lecture type tableur).
 * Les jours inexistants (29-31 fév, 31 avril…) sont grisés vides.
 */
export default function MonthColumn({
  year,
  monthIndex,
  eventsByDate,
  placeholdersByDate,
  holidaysByDate,
  todayStr,
  isInSelection,
  filterFamily,
  onDayClick,
  onDayHover,
}: Props) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDow = new Date(year, monthIndex, 1).getDay();

  // Préfixe ISO du mois pour construire dateStr sans new Date() par cellule
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return (
    <div className="bg-white">
      <div className="h-[26px] flex items-center justify-center text-[11px] font-semibold text-slate-700 bg-slate-50 border-b border-slate-200 px-0.5 truncate">
        {FRENCH_MONTHS[monthIndex]}
      </div>

      {Array.from({ length: 31 }).map((_, i) => {
        const dayNum = i + 1;

        if (dayNum > daysInMonth) {
          // Jour inexistant → cellule grisée vide (décision spec #31)
          return (
            <div
              key={i}
              className="h-[22px] bg-slate-50/80 border-b border-slate-100"
            />
          );
        }

        const dow = (firstDow + i) % 7;
        const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, "0")}`;
        const dayEvents = eventsByDate.get(dateStr) ?? NO_EVENTS;

        const placeholder =
          dayEvents.length === 0 ? placeholdersByDate.get(dateStr) : undefined;

        return (
          <DayCellDesktop
            key={dateStr}
            dayNum={dayNum}
            dateStr={dateStr}
            todayStr={todayStr}
            weekdayLetter={WEEKDAY_LETTERS[dow]}
            isSaturday={dow === 6}
            isSunday={dow === 0}
            holidayName={holidaysByDate.get(dateStr)}
            isSelected={isInSelection(dateStr)}
            dayEvents={dayEvents}
            placeholder={placeholder}
            filterFamily={filterFamily}
            onDayClick={onDayClick}
            onDayHover={onDayHover}
          />
        );
      })}
    </div>
  );
}
