"use client";

import MonthColumn from "./MonthColumn";

import type { Placeholder } from "@/lib/summer-placeholders";
import type { CalendarEvent } from "../CalendarDayCell";
import type { CalendarView } from "../calendar-utils";


type Props = {
  year: number;
  view: CalendarView;
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
 * Grille année 12 colonnes × 31 jours (#31).
 * `gap-px` sur fond slate = filets verticaux entre colonnes, façon tableur.
 * En dessous de ~1100px utiles, le parent (CalendarDesktopView) fournit
 * le scroll horizontal.
 */
export default function YearGrid({
  year,
  view,
  eventsByDate,
  placeholdersByDate,
  holidaysByDate,
  todayStr,
  isInSelection,
  filterFamily,
  onDayClick,
  onDayHover,
}: Props) {
  return (
    <div className="grid grid-cols-12 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden min-w-[1100px]">
      {Array.from({ length: 12 }).map((_, monthIndex) => (
        <MonthColumn
          key={monthIndex}
          year={year}
          monthIndex={monthIndex}
          view={view}
          eventsByDate={eventsByDate}
          placeholdersByDate={placeholdersByDate}
          holidaysByDate={holidaysByDate}
          todayStr={todayStr}
          isInSelection={isInSelection}
          filterFamily={filterFamily}
          onDayClick={onDayClick}
          onDayHover={onDayHover}
        />
      ))}
    </div>
  );
}
