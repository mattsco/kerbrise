"use client";

import { useEffect, useMemo, useState } from "react";

import YearGrid from "./YearGrid";
import YearOccupancyStats from "./YearOccupancyStats";
import TideLegend from "./TideLegend";
import Sidepanel from "./Sidepanel";

import { getHolidaysForYear } from "@/lib/holidays";
import {
  computePlaceholdersForYear,
  type Placeholder,
  type BookingMinimal,
} from "@/lib/summer-placeholders";
import {
  computeBannerContext,
  type UpcomingBooking,
} from "@/lib/dashboard-banner";
import type { FamilyName } from "@/lib/families";

import { dateToISO, type CalendarView } from "../calendar-utils";
import type { CalendarEvent } from "../CalendarDayCell";


type Props = {
  today: Date;
  events: CalendarEvent[];
  eventsByDate: Map<string, CalendarEvent[]>;
  bookingsMinimal: BookingMinimal[];
  currentFamilyId: string;
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
  onNewBooking: () => void;
};

/**
 * Vue desktop année entière façon tableur (#31).
 *
 * État propre : année affichée + filtre famille + mode de vue
 * (séjours / marées). Tout le reste (sélection 2 clics, modals) vit dans
 * Calendar.tsx et est partagé avec la vue mobile.
 *
 * Données : les events arrivent déjà non bornés depuis
 * getCalendarBookings() — la navigation d'année est un simple filtre
 * d'affichage, aucune query supplémentaire. Les marées sont statiques
 * (lib/tides.ts), aucune query non plus.
 */
export default function CalendarDesktopView({
  today,
  events,
  eventsByDate,
  bookingsMinimal,
  currentFamilyId,
  rangeStart,
  isInSelection,
  onDayClick,
  onDayHover,
  onCancelSelection,
  onNewBooking,
}: Props) {
  const currentYear = today.getFullYear();
  const todayStr = dateToISO(today);

  const [year, setYear] = useState(currentYear);
  const [filterFamily, setFilterFamily] = useState<FamilyName | null>(null);
  const [view, setView] = useState<CalendarView>("stays");

  // Échap annule la sélection en cours (confort desktop)
  useEffect(() => {
    if (!rangeStart) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelSelection();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rangeStart, onCancelSelection]);

  // Fériés de l'année affichée : date → nom court (ex. "Assomption")
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of getHolidaysForYear(year)) {
      map.set(h.date, h.shortName);
    }
    return map;
  }, [year]);

  // Placeholders été libres de l'année affichée, peints jour par jour
  // (même convention inclusive que la vue mobile)
  const placeholdersByDate = useMemo(() => {
    const map = new Map<string, Placeholder>();
    for (const p of computePlaceholdersForYear(year, bookingsMinimal)) {
      if (p.status !== "free") continue;
      let current = new Date(p.startDate);
      const end = new Date(p.endDate);
      while (current <= end) {
        map.set(dateToISO(current), p);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [year, bookingsMinimal]);

  // Séjours approuvés en cours/à venir, triés (getCalendarBookings
  // ordonne déjà par start_date) → bannière + "Mes prochains séjours"
  const upcoming = useMemo<UpcomingBooking[]>(
    () =>
      events
        .filter((e) => e.status === "approved" && e.end_date >= todayStr)
        .map((e) => ({
          id: e.bookingId,
          start_date: e.start_date,
          end_date: e.end_date,
          family_id: e.family_id,
          family_name: e.family_name,
          family_color: e.color,
        })),
    [events, todayStr]
  );

  const bannerContext = useMemo(
    () => computeBannerContext(upcoming, currentFamilyId, todayStr),
    [upcoming, currentFamilyId, todayStr]
  );

  const myStays = useMemo(
    () =>
      upcoming.filter((b) => b.family_id === currentFamilyId).slice(0, 3),
    [upcoming, currentFamilyId]
  );

  function toggleFamily(name: FamilyName) {
    setFilterFamily((prev) => (prev === name ? null : name));
  }

  return (
    <div className="flex gap-5 items-start">
      <Sidepanel
        filterFamily={filterFamily}
        onToggleFamily={toggleFamily}
        view={view}
        onViewChange={setView}
        year={year}
        currentYear={currentYear}
        onYearChange={setYear}
        onNewBooking={onNewBooking}
        bannerContext={bannerContext}
        myStays={myStays}
      />

      <div className="flex-1 min-w-0">
        {rangeStart && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center justify-between">
            <span>
              Clique un second jour pour terminer la sélection
            </span>
            <button
              onClick={onCancelSelection}
              className="text-xs font-medium text-blue-600 hover:underline shrink-0 ml-3"
            >
              Annuler (Échap)
            </button>
          </div>
        )}

        <div className="overflow-x-auto pb-2">
          <YearGrid
            year={year}
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
        </div>

        {view === "stays" ? (
          <YearOccupancyStats events={events} year={year} />
        ) : (
          <TideLegend year={year} />
        )}
      </div>
    </div>
  );
}
