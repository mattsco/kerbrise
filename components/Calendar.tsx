"use client";

import { useMemo, useState, useCallback } from "react";

import BookingDetailModal from "./BookingDetailModal";
import NewBookingModal from "./NewBookingModal";
import SummerPlaceholderModal from "./SummerPlaceholderModal";

import CalendarMobileView from "./calendar/CalendarMobileView";
import CalendarDesktopView from "./calendar/desktop/CalendarDesktopView";

import {
  computePlaceholdersForYear,
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
  familyHeadNames: string[];
  isCalendarAdmin?: boolean;
};


/**
 * Cerveau partagé du calendrier (#31) :
 *   - état de sélection 2 clics + état des 3 modals
 *   - maps dérivées des events (partagées par les 2 vues)
 *   - dispatch responsive pur CSS : mobile = 3 mois empilés,
 *     desktop (md:) = année entière façon tableur.
 *
 * Les vues ne possèdent QUE leur état de navigation propre
 * (anchorMonth côté mobile, année + filtre famille côté desktop).
 */
export default function Calendar({
  events,
  currentUserId,
  currentFamilyId,
  currentFamilyName,
  isFamilyHead,
  familyHeadNames,
  isCalendarAdmin = false,
}: Props) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );

  const [selectedPlaceholder, setSelectedPlaceholder] =
    useState<Placeholder | null>(null);

  // start/end absents = modal ouvert sans dates préremplies
  // (bouton "+ Nouvelle demande" du sidepanel desktop).
  const [newBooking, setNewBooking] = useState<{
    start?: string;
    end?: string;
  } | null>(null);

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Forme minimale partagée : placeholders été (2 vues) + modal été.
  const bookingsMinimal = useMemo<BookingMinimal[]>(
    () =>
      events.map((e) => ({
        start_date: e.start_date,
        end_date: e.end_date,
        family_id: e.family_id,
        family_name: e.family_name,
        family_color: e.color,
        status: e.status,
      })),
    [events]
  );

  // Map date -> events[] (calculée une seule fois, partagée par les 2 vues)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const current = new Date(event.start_date);
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

  // Stable callbacks → permet aux cellules (memo) de skip re-render
  const handleDayClick = useCallback(
    (
      dateStr: string,
      hasEvent: boolean,
      eventBookingId?: string,
      placeholder?: Placeholder
    ) => {
      // Booking existant
      if (hasEvent && eventBookingId) {
        setSelectedBookingId(eventBookingId);
        setRangeStart(null);
        return;
      }

      // Placeholder été
      if (placeholder) {
        setSelectedPlaceholder(placeholder);
        setRangeStart(null);
        setHoverDate(null);
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
      setNewBooking({ start, end });
      setRangeStart(null);
      setHoverDate(null);
    },
    [rangeStart]
  );

  const handleDayHover = useCallback(
    (dateStr: string) => {
      if (rangeStart) setHoverDate(dateStr);
    },
    [rangeStart]
  );

  const cancelSelection = useCallback(() => {
    setRangeStart(null);
    setHoverDate(null);
  }, []);

  // Sidepanel desktop : ouvre le modal de création sans dates.
  const openNewBooking = useCallback(() => {
    setRangeStart(null);
    setHoverDate(null);
    setNewBooking({});
  }, []);

  function isInSelection(dateStr: string) {
    if (!rangeStart) return false;
    const end = hoverDate ?? rangeStart;
    const min = rangeStart < end ? rangeStart : end;
    const max = rangeStart < end ? end : rangeStart;
    return dateStr >= min && dateStr <= max;
  }

  return (
    <>
      {/* Mobile : 3 mois empilés (vue historique, inchangée) */}
      <div className="md:hidden">
        <CalendarMobileView
          today={today}
          eventsByDate={eventsByDate}
          bookingsMinimal={bookingsMinimal}
          rangeStart={rangeStart}
          isInSelection={isInSelection}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
          onCancelSelection={cancelSelection}
        />
      </div>

      {/* Desktop : année entière façon tableur (#31) */}
      <div className="hidden md:block">
        <CalendarDesktopView
          today={today}
          events={events}
          eventsByDate={eventsByDate}
          bookingsMinimal={bookingsMinimal}
          currentFamilyId={currentFamilyId}
          rangeStart={rangeStart}
          isInSelection={isInSelection}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
          onCancelSelection={cancelSelection}
          onNewBooking={openNewBooking}
        />
      </div>

      {/* Modals — partagées par les 2 vues */}
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

      {newBooking && (
        <NewBookingModal
          familyId={currentFamilyId}
          userId={currentUserId}
          initialStart={newBooking.start}
          initialEnd={newBooking.end}
          isCalendarAdmin={isCalendarAdmin}
          onClose={() => setNewBooking(null)}
        />
      )}

      {selectedPlaceholder && (
        <SummerPlaceholderModal
          placeholder={selectedPlaceholder}
          allPlaceholdersForYear={computePlaceholdersForYear(
            selectedPlaceholder.year,
            bookingsMinimal
          )}
          myFamilyId={currentFamilyId}
          myFamilyName={currentFamilyName}
          myUserId={currentUserId}
          myIsFamilyHead={isFamilyHead}
          myFamilyHeadNames={familyHeadNames}
          onClose={() => setSelectedPlaceholder(null)}
        />
      )}
    </>
  );
}
