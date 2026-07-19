"use client";

import { useMemo, useState } from "react";

import MonthGrid from "./MonthGrid";

import { getHolidaysInRange } from "@/lib/holidays";
import { FAMILIES } from "@/lib/families";

import {
  getAllUpcomingPlaceholders,
  type Placeholder,
  type BookingMinimal,
} from "@/lib/summer-placeholders";

import { dateToISO } from "./calendar-utils";

import type { CalendarEvent } from "./CalendarDayCell";


type Props = {
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  bookingsMinimal: BookingMinimal[];
  rangeStart: string | null;
  isInSelection: (dateStr: string) => boolean;
  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;
  onDayHover: (dateStr: string) => void;
  onCancelSelection: () => void;
};


/**
 * Vue mobile historique : 3 mois empilés + navigation mois par mois.
 * Extraite de Calendar.tsx lors du #31 — comportement inchangé.
 * Possède uniquement son état de navigation (anchorMonth) ; la sélection,
 * les modals et les maps d'events vivent dans Calendar.tsx (partagés).
 */
export default function CalendarMobileView({
  today,
  eventsByDate,
  bookingsMinimal,
  rangeStart,
  isInSelection,
  onDayClick,
  onDayHover,
  onCancelSelection,
}: Props) {
  const [anchorMonth, setAnchorMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // 3 mois affichés
  const months = useMemo(() => {
    return Array.from(
      { length: 3 },
      (_, i) =>
        new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + i, 1)
    );
  }, [anchorMonth]);

  // Jours fériés
  const holidaySet = useMemo(() => {
    const startMonth = months[0];
    const endMonth = months[months.length - 1];

    const startISO = dateToISO(
      new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)
    );
    const endISO = dateToISO(
      new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0)
    );

    const list = getHolidaysInRange(startISO, endISO);
    return new Set(list.map((h) => h.date));
  }, [months]);

  // Map date -> placeholder été (uniquement les "free")
  const placeholdersByDate = useMemo(() => {
    const minYear = months[0].getFullYear();
    const maxYear = months[months.length - 1].getFullYear();
    const placeholders = getAllUpcomingPlaceholders(
      bookingsMinimal,
      minYear,
      maxYear
    );

    const map = new Map<string, Placeholder>();
    for (const p of placeholders) {
      if (p.status !== "free") continue;
      const current = new Date(p.startDate);
      const end = new Date(p.endDate);
      while (current <= end) {
        map.set(dateToISO(current), p);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [bookingsMinimal, months]);

  function goPrevMonth() {
    setAnchorMonth(
      new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1)
    );
  }

  function goNextMonth() {
    setAnchorMonth(
      new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1)
    );
  }

  function goToday() {
    setAnchorMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <>
      {/* Header navigation */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <button
          onClick={goPrevMonth}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
          aria-label="Mois précédent"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          onClick={goToday}
          className="text-sm text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition"
        >
          Aujourd&apos;hui
        </button>

        <button
          onClick={goNextMonth}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
          aria-label="Mois suivant"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs text-slate-600">
        {FAMILIES.map((f) => (
          <div key={f.name} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: f.color }}
            />
            <span>{f.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400" />
          <span>En attente</span>
        </div>
      </div>

      {/* Bandeau sélection */}
      {rangeStart && (
        <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between">
          <span>📅 Touche une seconde date pour terminer la sélection</span>
          <button onClick={onCancelSelection} className="text-blue-700 underline">
            Annuler
          </button>
        </div>
      )}

      {/* Mois */}
      <div className="grid gap-6 lg:grid-cols-2">
        {months.map((monthDate, idx) => (
          <MonthGrid
            key={idx}
            monthDate={monthDate}
            eventsByDate={eventsByDate}
            placeholdersByDate={placeholdersByDate}
            today={today}
            isInSelection={isInSelection}
            onDayClick={onDayClick}
            onDayHover={onDayHover}
            holidaySet={holidaySet}
          />
        ))}
      </div>
    </>
  );
}
