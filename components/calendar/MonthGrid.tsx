"use client";

import type { Placeholder } from "@/lib/summer-placeholders";

import CalendarDayCell, {
  type CalendarEvent,
} from "./CalendarDayCell";

import {
  dateToISO,
  dayIndex,
  isWeekendIndex,
} from "./calendar-utils";

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
  events: CalendarEvent[];
  placeholders: Placeholder[];

  today: Date;

  isInSelection: (dateStr: string) => boolean;

  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string
  ) => void;

  onDayHover: (dateStr: string) => void;

  holidaySet: Set<string>;
};

export default function MonthGrid({
  monthDate,
  events,
  placeholders,
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

  const totalCells =
    Math.ceil((offsetStart + daysInMonth) / 7) * 7;

  function getEventsForDay(
    dateStr: string
  ): CalendarEvent[] {
    return events.filter(
      (e) =>
        dateStr >= e.start_date &&
        dateStr <= e.end_date
    );
  }

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
              isWeekendIndex(i)
                ? "text-slate-400"
                : "text-slate-500"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }).map(
          (_, i) => {
            const dayNum =
              i - offsetStart + 1;

            const inMonth =
              dayNum >= 1 &&
              dayNum <= daysInMonth;

            if (!inMonth) {
              return (
                <div
                  key={i}
                  className="h-14"
                />
              );
            }

            const date = new Date(
              year,
              month,
              dayNum
            );

            const dateStr = dateToISO(date);

            const dayEvents =
              getEventsForDay(dateStr);

            const isSelected =
              isInSelection(dateStr);

            const weekIndex = i % 7;

            const isWeekend =
              isWeekendIndex(weekIndex);

            const isHoliday =
              holidaySet.has(dateStr);

            const isSpecialDay =
              isWeekend || isHoliday;

            // Placeholder libre uniquement si aucun event
            const placeholder =
              dayEvents.length === 0
                ? placeholders.find(
                    (p) =>
                      p.status === "free" &&
                      dateStr >=
                        p.startDate &&
                      dateStr <= p.endDate
                  )
                : undefined;

            return (
              <CalendarDayCell
                key={i}
                i={i}
                dayNum={dayNum}
                date={date}
                dateStr={dateStr}
                today={today}
                isSpecialDay={
                  isSpecialDay
                }
                isSelected={isSelected}
                dayEvents={dayEvents}
                placeholder={placeholder}
                onDayClick={onDayClick}
                onDayHover={onDayHover}
              />
            );
          }
        )}
      </div>
    </div>
  );
}