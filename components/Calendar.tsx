"use client";

import { useState } from "react";
import BookingDetailModal from "./BookingDetailModal";
import NewBookingModal from "./NewBookingModal";

type CalendarEvent = {
  id: string;
  bookingId: string;
  start_date: string;
  end_date: string;
  family_name: string;
  color: string;
  status: "pending" | "approved";
};

type Props = {
  events: CalendarEvent[];
  currentUserId: string;
  currentFamilyId: string;
  isFamilyHead: boolean;
};

const FRENCH_MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const FRENCH_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Renvoie l'indice 0-6 où 0 = Lundi, 6 = Dimanche
function dayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

export default function Calendar({
  events,
  currentUserId,
  currentFamilyId,
  isFamilyHead,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Premier mois affiché : le mois courant par défaut
  const [anchorMonth, setAnchorMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [newBookingRange, setNewBookingRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  // Sélection de plage (drag/tap)
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  function goPrevMonth() {
    setAnchorMonth(new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1));
  }
  function goNextMonth() {
    setAnchorMonth(new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1));
  }
  function goToday() {
    setAnchorMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function handleDayClick(dateStr: string, hasEvent: boolean, eventBookingId?: string) {
    // Si l'utilisateur a cliqué sur un événement, ouvre la modale détail
    if (hasEvent && eventBookingId) {
      setSelectedBookingId(eventBookingId);
      setRangeStart(null);
      return;
    }

    // Sinon, gestion de la sélection de plage
    if (!rangeStart) {
      setRangeStart(dateStr);
      return;
    }

    // 2e clic : ouvre la modale nouvelle demande
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

  function isInSelection(dateStr: string): boolean {
    if (!rangeStart) return false;
    const end = hoverDate ?? rangeStart;
    const min = rangeStart < end ? rangeStart : end;
    const max = rangeStart < end ? end : rangeStart;
    return dateStr >= min && dateStr <= max;
  }

  // Génère les 3 mois affichés
  const months: Date[] = [];
  for (let i = 0; i < 3; i++) {
    months.push(new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + i, 1));
  }

  return (
    <>
      {/* Header avec navigation */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <button
          onClick={goPrevMonth}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
          aria-label="Mois précédent"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToday}
          className="text-sm text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition"
        >
          Aujourd'hui
        </button>

        <button
          onClick={goNextMonth}
          className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
          aria-label="Mois suivant"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Légende des familles */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Antoine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>François</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Vincent</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400" />
          <span>En attente</span>
        </div>
      </div>

      {/* Bandeau aide */}
      {rangeStart && (
        <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 flex items-center justify-between">
          <span>📅 Touche une seconde date pour terminer la sélection</span>
          <button
            onClick={cancelSelection}
            className="text-blue-700 underline"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Grille des mois (1 col mobile, 2 cols ≥ lg) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {months.map((monthDate, idx) => (
          <MonthGrid
            key={idx}
            monthDate={monthDate}
            events={events}
            today={today}
            rangeStart={rangeStart}
            hoverDate={hoverDate}
            isInSelection={isInSelection}
            onDayClick={handleDayClick}
            onDayHover={handleDayHover}
          />
        ))}
      </div>

      {selectedBookingId && (
        <BookingDetailModal
          bookingId={selectedBookingId}
          currentUserId={currentUserId}
          currentFamilyId={currentFamilyId}
          isFamilyHead={isFamilyHead}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {newBookingRange && (
        <NewBookingModal
          familyId={currentFamilyId}
          userId={currentUserId}
          initialStart={newBookingRange.start}
          initialEnd={newBookingRange.end}
          onClose={() => setNewBookingRange(null)}
        />
      )}
    </>
  );
}

// ============================================
// Composant : Grille d'un mois
// ============================================

type MonthGridProps = {
  monthDate: Date;
  events: CalendarEvent[];
  today: Date;
  rangeStart: string | null;
  hoverDate: string | null;
  isInSelection: (dateStr: string) => boolean;
  onDayClick: (dateStr: string, hasEvent: boolean, eventBookingId?: string) => void;
  onDayHover: (dateStr: string) => void;
};

function MonthGrid({
  monthDate,
  events,
  today,
  isInSelection,
  onDayClick,
  onDayHover,
}: MonthGridProps) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const offsetStart = dayIndex(firstDayOfMonth);
  const daysInMonth = lastDayOfMonth.getDate();
  const totalCells = Math.ceil((offsetStart + daysInMonth) / 7) * 7;

  // Renvoie TOUS les events qui couvrent cette date
  function getEventsForDay(dateStr: string): CalendarEvent[] {
    return events.filter(
      (e) => dateStr >= e.start_date && dateStr <= e.end_date
    );
  }

  return (
    <div>
      {/* Nom du mois */}
      <h3 className="text-base font-semibold text-slate-900 mb-3 text-center">
        {FRENCH_MONTHS[month]} {year}
      </h3>

      {/* Entêtes jours de semaine */}
      <div className="grid grid-cols-7 mb-1">
        {FRENCH_DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-xs font-medium text-slate-500 text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cellules */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - offsetStart + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          if (!inMonth) {
            return <div key={i} className="h-14" />;
          }

          const date = new Date(year, month, dayNum);
          const dateStr = dateToISO(date);
          const dayEvents = getEventsForDay(dateStr);
          const isToday = isSameDay(date, today);
          const isPast = date < today;
          const isSelected = isInSelection(dateStr);

          // Détection du pivot : 2 events ce même jour, l'un finit, l'autre commence
          const endingEvent = dayEvents.find((e) => e.end_date === dateStr);
          const startingEvent = dayEvents.find((e) => e.start_date === dateStr);
          const isPivot =
            !!endingEvent &&
            !!startingEvent &&
            endingEvent.bookingId !== startingEvent.bookingId;

          // Event principal à afficher (cas non-pivot)
          const mainEvent = dayEvents[0];

          // Click handler : si pivot, on a 2 events possibles
          function handleClick() {
            if (isPivot && startingEvent) {
              // Sur un pivot, on ouvre l'event qui commence (le plus actionnable)
              onDayClick(dateStr, true, startingEvent.bookingId);
            } else if (mainEvent) {
              onDayClick(dateStr, true, mainEvent.bookingId);
            } else {
              onDayClick(dateStr, false);
            }
          }

          return (
            <div
              key={i}
              className="h-14 relative cursor-pointer"
              onClick={handleClick}
              onMouseEnter={() => onDayHover(dateStr)}
              onTouchStart={() => onDayHover(dateStr)}
            >
              {/* Numéro du jour */}
              <div
                className={`
                  absolute top-1 left-1/2 -translate-x-1/2 z-10
                  w-7 h-7 flex items-center justify-center text-xs font-medium rounded-full
                  ${isToday ? "bg-slate-900 text-white" : ""}
                  ${!isToday && isPast ? "text-slate-300" : ""}
                  ${!isToday && !isPast ? "text-slate-900" : ""}
                `}
              >
                {dayNum}
              </div>

              {/* Sélection en cours */}
              {isSelected && dayEvents.length === 0 && (
                <div className="absolute inset-0 bg-blue-100/60 rounded" />
              )}

              {/* === RENDU DES EVENTS === */}

              {isPivot && endingEvent && startingEvent ? (
                // Cas pivot : 2 demi-barres
                <>
                  {/* Gauche : famille qui finit */}
                  <div
                    className={`
                      absolute bottom-1 left-0 w-1/2 h-6
                      ${endingEvent.status === "pending" ? "border-2 border-dashed border-white/70" : ""}
                    `}
                    style={{
                      backgroundColor: endingEvent.color,
                      opacity: endingEvent.status === "pending" ? 0.75 : 1,
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      borderTopRightRadius: 12,
                      borderBottomRightRadius: 12,
                      marginRight: 1,
                    }}
                  />
                  {/* Droite : famille qui commence */}
                  <div
                    className={`
                      absolute bottom-1 right-0 w-1/2 h-6 text-[11px] text-white font-medium
                      flex items-center px-1 truncate
                      ${startingEvent.status === "pending" ? "border-2 border-dashed border-white/70" : ""}
                    `}
                    style={{
                      backgroundColor: startingEvent.color,
                      opacity: startingEvent.status === "pending" ? 0.75 : 1,
                      borderTopLeftRadius: 12,
                      borderBottomLeftRadius: 12,
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      marginLeft: 1,
                    }}
                  >
                    <span className="truncate">
                      {startingEvent.family_name}
                      {startingEvent.status === "pending" ? " ⏳" : ""}
                    </span>
                  </div>
                </>
              ) : mainEvent ? (
                // Cas normal : barre simple
                (() => {
                  const isFirstOfEvent = mainEvent.start_date === dateStr;
                  const isLastOfEvent = mainEvent.end_date === dateStr;
                  return (
                    <div
                      className={`
                        absolute bottom-1 left-0 right-0 h-6 text-[11px] text-white font-medium
                        flex items-center px-1 truncate
                        ${mainEvent.status === "pending" ? "border-2 border-dashed border-white/70" : ""}
                      `}
                      style={{
                        backgroundColor: mainEvent.color,
                        opacity: mainEvent.status === "pending" ? 0.75 : 1,
                        borderTopLeftRadius: isFirstOfEvent ? 12 : 0,
                        borderBottomLeftRadius: isFirstOfEvent ? 12 : 0,
                        borderTopRightRadius: isLastOfEvent ? 12 : 0,
                        borderBottomRightRadius: isLastOfEvent ? 12 : 0,
                        marginLeft: isFirstOfEvent ? 4 : 0,
                        marginRight: isLastOfEvent ? 4 : 0,
                      }}
                    >
                      {isFirstOfEvent && (
                        <span className="truncate">
                          {mainEvent.family_name}
                          {mainEvent.status === "pending" ? " ⏳" : ""}
                        </span>
                      )}
                    </div>
                  );
                })()
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}