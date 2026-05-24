"use client";

import type { Placeholder } from "@/lib/summer-placeholders";

import CalendarDayCell, {
  type CalendarEvent,
} from "./CalendarDayCell";

import { dateToISO, dayIndex, isWeekendIndex } from "./calendar-utils";

const FRENCH_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const FRENCH_DAYS_SHORT = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
];

type Props = {
  monthDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  placeholdersByDate: Map<string, Placeholder>;
  today: Date;
  isInSelection: (dateStr: string) => boolean;
  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;
  onDayHover: (dateStr: string) => void;
  holidaySet: Set<string>;
};

export default function MonthGrid({
  monthDate,
  eventsByDate,
  placeholdersByDate,
  today,
  isInSelection,
  onDayClick,
  onDayHover,
  holidaySet,
}: Props) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const offsetStart = dayIndex(firstDayOfMonth);
  const daysInMonth = lastDayOfMonth.getDate();

  const totalCells = Math.ceil((offsetStart + daysInMonth) / 7) * 7;

const todayStr = dateToISO(today);

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-3 text-center">
        {FRENCH_MONTHS[month]} {year}
      </h3>

      <div className="grid grid-cols-7 mb-1">
        {FRENCH_DAYS_SHORT.map((d, i) => (
          <div
            key={d}
            className={`text-xs font-medium text-center py-1 ${
              isWeekendIndex(i) ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - offsetStart + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

          if (!inMonth) {
            return <div key={i} className="h-[52px]" />;
          }

          
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

          const dayEvents = eventsByDate.get(dateStr) ?? [];

          // DEV safety: warn si plus de 2 events overlappent (cas anormal)
          if (
            process.env.NODE_ENV === "development" &&
            dayEvents.length > 2
          ) {
            console.warn(
              "[Calendar] Overlapping events detected:",
              dateStr,
              dayEvents
            );
          }

          const isSelected = isInSelection(dateStr);
          const weekIndex = i % 7;
          const isWeekend = isWeekendIndex(weekIndex);
          const isHoliday = holidaySet.has(dateStr);
          const isSpecialDay = isWeekend || isHoliday;

          const placeholder =
            dayEvents.length === 0
              ? placeholdersByDate.get(dateStr)
              : undefined;

          return (
            <CalendarDayCell
              key={dateStr}
              dayNum={dayNum}
              date={date}
              dateStr={dateStr}
              todayStr={todayStr}
              isSpecialDay={isSpecialDay}
              isSelected={isSelected}
              dayEvents={dayEvents}
              placeholder={placeholder}
              onDayClick={onDayClick}
              onDayHover={onDayHover}
            />
          );
        })}
      </div>
    </div>
  );
}