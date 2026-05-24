"use client";

import { useMemo, useState } from "react";

import BookingDetailModal from "./BookingDetailModal";
import NewBookingModal from "./NewBookingModal";
import SummerPlaceholderModal from "./SummerPlaceholderModal";

import MonthGrid from "./calendar/MonthGrid";

import { getHolidaysInRange } from "@/lib/holidays";
import { FAMILIES } from "@/lib/families";

import {
  getAllUpcomingPlaceholders,
  type Placeholder,
  type BookingMinimal,
} from "@/lib/summer-placeholders";

import { dateToISO } from "./calendar/calendar-utils";

import type { CalendarEvent } from "./calendar/CalendarDayCell";

type Props = {
  events: CalendarEvent[];
  currentUserId: string;
  currentFamilyId: string;
  currentFamilyName: string;
  isFamilyHead: boolean;
  isCalendarAdmin?: boolean;
};

export default function Calendar({
  events,
  currentUserId,
  currentFamilyId,
  currentFamilyName,
  isFamilyHead,
  isCalendarAdmin = false,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [anchorMonth, setAnchorMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );

  const [selectedPlaceholder, setSelectedPlaceholder] =
    useState<Placeholder | null>(null);

  const [newBookingRange, setNewBookingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

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

  // Placeholders été
  const placeholders = useMemo(() => {
    const bookingsMinimal: BookingMinimal[] = events.map((e) => ({
      start_date: e.start_date,
      end_date: e.end_date,
      family_id: e.family_id,
      family_name: e.family_name,
      family_color: e.color,
      status: e.status,
    }));

    const minYear = months[0].getFullYear();
    const maxYear = months[months.length - 1].getFullYear();

    return getAllUpcomingPlaceholders(bookingsMinimal, minYear, maxYear);
  }, [events, months]);

  // Map date -> events[] (calculée une seule fois, partagée par les 3 MonthGrid)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      let current = new Date(event.start_date);
      const end = new Date(event.end_date);
      while (current <= end) {
        const key = dateToISO(current);
        const existing = map.get(key) ?? [];
        existing.push(event);
        map.set(key, existing);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  // Map date -> placeholder (uniquement les "free")
  const placeholdersByDate = useMemo(() => {
    const map = new Map<string, Placeholder>();
    for (const p of placeholders) {
      if (p.status !== "free") continue;
      let current = new Date(p.startDate);
      const end = new Date(p.endDate);
      while (current <= end) {
        map.set(dateToISO(current), p);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [placeholders]);

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

  function handlePlaceholderClick(placeholder: Placeholder) {
    setSelectedPlaceholder(placeholder);
    setRangeStart(null);
    setHoverDate(null);
  }

  function handleDayClick(
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) {
    // Booking existant
    if (hasEvent && eventBookingId) {
      setSelectedBookingId(eventBookingId);
      setRangeStart(null);
      return;
    }

    // Placeholder été
    if (placeholder) {
      handlePlaceholderClick(placeholder);
      return;
    }

    // Début sélection
    if (!rangeStart) {
      setRangeStart(dateStr);
      return;
    }

    // Fin sélection
    const start = rangeStart < dateStr ? rangeStart : dateStr;
    const end = rangeStart < dateStr ? dateStr : rangeStart;

    setNewBookingRange({ start, end });
    setRangeStart(null);
    setHoverDate(null);
  }

  function handleDayHover(dateStr: string) {
    if (rangeStart) {
      setHoverDate(dateStr);
    }
  }

  function cancelSelection() {
    setRangeStart(null);
    setHoverDate(null);
  }

  function isInSelection(dateStr: string) {
    if (!rangeStart) return false;
    const end = hoverDate ?? rangeStart;
    const min = rangeStart < end ? rangeStart : end;
    const max = rangeStart < end ? end : rangeStart;
    return dateStr >= min && dateStr <= max;
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
          <button onClick={cancelSelection} className="text-blue-700 underline">
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
            onDayClick={handleDayClick}
            onDayHover={handleDayHover}
            holidaySet={holidaySet}
          />
        ))}
      </div>

      {/* Modal booking */}
      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          currentUserId={currentUserId}
          currentFamilyId={currentFamilyId}
          isFamilyHead={isFamilyHead}
          isCalendarAdmin={isCalendarAdmin}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {/* Modal création */}
      {newBookingRange && (
        <NewBookingModal
          familyId={currentFamilyId}
          userId={currentUserId}
          initialStart={newBookingRange.start}
          initialEnd={newBookingRange.end}
          onClose={() => setNewBookingRange(null)}
        />
      )}

      {/* Modal placeholder */}
      {selectedPlaceholder && (
        <SummerPlaceholderModal
          placeholder={selectedPlaceholder}
          allPlaceholdersForYear={placeholders.filter(
            (p) => p.year === selectedPlaceholder.year
          )}
          myFamilyId={currentFamilyId}
          myFamilyName={currentFamilyName}
          myUserId={currentUserId}
          onClose={() => setSelectedPlaceholder(null)}
        />
      )}
    </>
  );
}