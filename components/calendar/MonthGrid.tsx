"use client";

import type { Placeholder } from "@/lib/summer-placeholders";

import CalendarDayCell, {
  type CalendarEvent,
} from "./CalendarDayCell";

import {
  dateToISO,
  dayIndex,
  isWeekendIndex,
  FRENCH_MONTHS,
} from "./calendar-utils";

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

  // String stable pour passer à chaque cellule (évite 90 × dateToISO())
  const todayStr = dateToISO(today);

  // Préfixe ISO du mois pour construire dateStr sans new Date()
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

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

          const dateStr = `${monthPrefix}-${String(dayNum).padStart(2, "0")}`;
          const dayEvents = eventsByDate.get(dateStr) ?? [];

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