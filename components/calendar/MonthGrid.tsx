"use client";

import { useMemo } from "react";

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

  isInSelection: (
    dateStr: string
  ) => boolean;

  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;

  onDayHover: (
    dateStr: string
  ) => void;

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
  const year =
    monthDate.getFullYear();

  const month =
    monthDate.getMonth();

  const firstDayOfMonth =
    new Date(year, month, 1);

  const lastDayOfMonth =
    new Date(year, month + 1, 0);

  const offsetStart =
    dayIndex(
      firstDayOfMonth
    );

  const daysInMonth =
    lastDayOfMonth.getDate();

  const totalCells =
    Math.ceil(
      (offsetStart +
        daysInMonth) /
        7
    ) * 7;

  // Map rapide :
  // date -> events[]
  const eventsByDate =
    useMemo(() => {
      const map =
        new Map<
          string,
          CalendarEvent[]
        >();

      for (const event of events) {
        let current =
          new Date(
            event.start_date
          );

        const end =
          new Date(
            event.end_date
          );

        while (
          current <= end
        ) {
          const key =
            dateToISO(
              current
            );

          const existing =
            map.get(key) ??
            [];

          existing.push(
            event
          );

          map.set(
            key,
            existing
          );

          current.setDate(
            current.getDate() +
              1
          );
        }
      }

      return map;
    }, [events]);

  // Map rapide :
  // date -> placeholder
  const placeholdersByDate =
    useMemo(() => {
      const map =
        new Map<
          string,
          Placeholder
        >();

      for (const p of placeholders) {
        if (
          p.status !==
          "free"
        ) {
          continue;
        }

        let current =
          new Date(
            p.startDate
          );

        const end =
          new Date(
            p.endDate
          );

        while (
          current <= end
        ) {
          const key =
            dateToISO(
              current
            );

          map.set(
            key,
            p
          );

          current.setDate(
            current.getDate() +
              1
          );
        }
      }

      return map;
    }, [placeholders]);

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-3 text-center">
        {
          FRENCH_MONTHS[
            month
          ]
        }{" "}
        {year}
      </h3>

      <div className="grid grid-cols-7 mb-1">
        {FRENCH_DAYS_SHORT.map(
          (d, i) => (
            <div
              key={d}
              className={`text-xs font-medium text-center py-1 ${
                isWeekendIndex(
                  i
                )
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              {d}
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({
          length:
            totalCells,
        }).map((_, i) => {
          const dayNum =
            i -
            offsetStart +
            1;

          const inMonth =
            dayNum >= 1 &&
            dayNum <=
              daysInMonth;

          if (!inMonth) {
            return (
              <div
                key={i}
                className="h-[52px]"
              />
            );
          }

          const date =
            new Date(
              year,
              month,
              dayNum
            );

          const dateStr =
            dateToISO(
              date
            );

          const dayEvents =
            eventsByDate.get(
              dateStr
            ) ?? [];

          // Safety DEV
          if (
            process.env
              .NODE_ENV ===
              "development" &&
            dayEvents.length >
              2
          ) {
            console.warn(
              "[Calendar] Overlapping events detected:",
              dateStr,
              dayEvents
            );
          }

          const isSelected =
            isInSelection(
              dateStr
            );

          const weekIndex =
            i % 7;

          const isWeekend =
            isWeekendIndex(
              weekIndex
            );

          const isHoliday =
            holidaySet.has(
              dateStr
            );

          const isSpecialDay =
            isWeekend ||
            isHoliday;

          // Placeholder seulement si aucun booking
          const placeholder =
            dayEvents.length ===
            0
              ? placeholdersByDate.get(
                  dateStr
                )
              : undefined;

          return (
            <CalendarDayCell
              key={i}
              dayNum={
                dayNum
              }
              date={date}
              dateStr={
                dateStr
              }
              today={today}
              isSpecialDay={
                isSpecialDay
              }
              isSelected={
                isSelected
              }
              dayEvents={
                dayEvents
              }
              placeholder={
                placeholder
              }
              onDayClick={
                onDayClick
              }
              onDayHover={
                onDayHover
              }
            />
          );
        })}
      </div>
    </div>
  );
}