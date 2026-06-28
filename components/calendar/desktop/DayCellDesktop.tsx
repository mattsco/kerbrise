"use client";

import { memo } from "react";

import type { Placeholder } from "@/lib/summer-placeholders";
import type { CalendarEvent } from "../CalendarDayCell";
import type { CalendarView } from "../calendar-utils";

import { daysBetween } from "@/lib/dates";
import { formatRange } from "@/lib/dashboard-banner";
import { tideLevel, type TideDay } from "@/lib/tides";


/**
 * Une cellule jour de la vue desktop (#31), pensée pour évoquer le
 * tableur familial historique :
 *
 *   [ 15 │ V │ Antoine (14j)████████ ]
 *
 *   - numéro du jour + lettre du jour (L M M J V S D), comme l'Excel
 *   - samedi / dimanche grisés à deux niveaux, comme l'Excel
 *   - férié : numéro en rouge + nom du férié si le jour est libre
 *   - séjour : bande de couleur famille continue verticalement,
 *     étiquette "Nom (Nj)" uniquement au premier jour
 *   - pending : opacité réduite + bord pointillé + ⏳ (conventions mobile)
 *
 * En vue "tides" (#31 V2), la cellule est recolorée par le coefficient
 * de marée du jour (heatmap) ; séjours, placeholders, fériés et grisé
 * week-end sont masqués — c'est un mode d'encodage à part entière.
 */

type Props = {
  dayNum: number;
  dateStr: string;
  todayStr: string;
  weekdayLetter: string;
  isSaturday: boolean;
  isSunday: boolean;
  holidayName?: string;
  isSelected: boolean;
  dayEvents: CalendarEvent[];
  placeholder?: Placeholder;
  /** Famille sélectionnée dans la légende ; les autres sont estompées. */
  filterFamily: string | null;
  /** Mode d'affichage de la grille. */
  view: CalendarView;
  /** Marée du jour (vue "tides" uniquement), null si année non couverte. */
  tideDay: TideDay | null;
  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;
  onDayHover: (dateStr: string) => void;
};

function DayCellDesktop({
  dayNum,
  dateStr,
  todayStr,
  weekdayLetter,
  isSaturday,
  isSunday,
  holidayName,
  isSelected,
  dayEvents,
  placeholder,
  filterFamily,
  view,
  tideDay,
  onDayClick,
  onDayHover,
}: Props) {
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

  // ─── Vue Marées : heatmap pure, autres encodages masqués ─────────────
  if (view === "tides") {
    const level = tideDay ? tideLevel(tideDay.coef) : null;
    const bg = level?.bg ?? "#ffffff";
    const txt = level?.text ?? "#94a3b8"; // slate-400 si pas de donnée
    const title = tideDay
      ? `Marée — coef ${tideDay.coef}${
          tideDay.raw.length > 1 ? ` (${tideDay.raw.join(" / ")})` : ""
        } · ${dateStr}`
      : `Pas de donnée de marée · ${dateStr}`;

    return (
      <div
        className={`relative flex items-stretch h-[22px] border-b border-slate-100 cursor-pointer ${
          isToday ? "ring-1 ring-inset ring-blue-400" : ""
        }`}
        style={{ backgroundColor: bg }}
        title={title}
        onClick={() => onDayClick(dateStr, false)}
        onMouseEnter={() => onDayHover(dateStr)}
      >
        <span
          className={`w-[18px] shrink-0 text-right pr-0.5 text-[10px] leading-[21px] tabular-nums ${
            isToday ? "font-bold" : ""
          }`}
          style={{ color: txt }}
        >
          {dayNum}
        </span>
        <span
          className="w-[13px] shrink-0 text-center text-[9px] leading-[21px]"
          style={{ color: txt }}
        >
          {weekdayLetter}
        </span>
        <div
          className="flex-1 min-w-0 flex items-center justify-center text-[10px] font-semibold tabular-nums"
          style={{ color: txt }}
        >
          {tideDay ? tideDay.coef : ""}
        </div>
      </div>
    );
  }

  // ─── Vue Séjours (défaut, #31) ───────────────────────────────────────
  // Le séjour qui DÉMARRE ce jour-là gagne la cellule, dessiné par-dessus la
  // fin du séjour précédent (comme les périodes d'été) : pas de demi-cellule
  // pivot, nom posé sur le 1er jour. Le séjour qui se termine est donc masqué
  // sur son jour de départ — il est rendu jusqu'à la veille.
  const startingEvent = dayEvents.find((e) => e.start_date === dateStr);
  const mainEvent = startingEvent ?? dayEvents[0];

  const isFirstOfEvent = !!mainEvent && mainEvent.start_date === dateStr;
  const isLastOfEvent = !!mainEvent && mainEvent.end_date === dateStr;

  const isFirstOfPlaceholder = placeholder?.startDate === dateStr;
  const isLastOfPlaceholder = placeholder?.endDate === dateStr;

  // Même priorité de clic que la vue mobile (CalendarDayCell)
  function handleClick() {
    if (mainEvent) {
      onDayClick(dateStr, true, mainEvent.bookingId);
      return;
    }
    onDayClick(dateStr, false, undefined, placeholder);
  }

  function isDimmed(e: CalendarEvent) {
    return filterFamily !== null && e.family_name !== filterFamily;
  }

  function zoneOpacity(e: CalendarEvent) {
    if (isDimmed(e)) return 0.12;
    return e.status === "pending" ? 0.75 : 1;
  }

  // Durée = NUITS (fin − début), convention Kerbrise : le jour de départ
  // (pivot) n'est pas compté. Ex : 28 juin → 19 juil = 21 nuits.
  function eventLabel(e: CalendarEvent) {
    const n = daysBetween(e.start_date, e.end_date);
    return `${e.family_name} (${n}j)${e.status === "pending" ? " ⏳" : ""}`;
  }

  function eventTooltip(e: CalendarEvent) {
    const n = daysBetween(e.start_date, e.end_date);
    return `${e.family_name} · ${formatRange(e.start_date, e.end_date)} · ${n}j${
      e.status === "pending" ? " · en attente" : ""
    }`;
  }

  // Fond de cellule : sélection > dimanche > samedi (mimique du tableur)
  const cellBg =
    isSelected && dayEvents.length === 0
      ? "bg-blue-100"
      : isSunday
      ? "bg-slate-200/70"
      : isSaturday
      ? "bg-slate-100"
      : "bg-white";

  const dayNumClass = isToday
    ? "font-bold text-blue-600"
    : holidayName
    ? "text-red-600"
    : isPast
    ? "text-slate-300"
    : "text-slate-600";

  return (
    <div
      className={`relative flex items-stretch h-[22px] border-b border-slate-100 cursor-pointer ${cellBg} ${
        isToday ? "ring-1 ring-inset ring-blue-400" : ""
      }`}
      onClick={handleClick}
      onMouseEnter={() => onDayHover(dateStr)}
    >
      {/* Numéro du jour */}
      <span
        className={`w-[18px] shrink-0 text-right pr-0.5 text-[10px] leading-[21px] tabular-nums ${dayNumClass}`}
      >
        {dayNum}
      </span>

      {/* Lettre du jour (L M M J V S D), comme l'Excel */}
      <span
        className={`w-[13px] shrink-0 text-center text-[9px] leading-[21px] ${
          holidayName ? "text-red-400" : "text-slate-400"
        }`}
      >
        {weekdayLetter}
      </span>

      {/* Zone séjour / placeholder / férié */}
      <div className="relative flex-1 min-w-0">
        {mainEvent ? (
          <div
            className={`absolute inset-0 flex items-center px-1 text-[10px] font-medium text-white ${
              mainEvent.status === "pending"
                ? `border-dashed border-white/70 border-x-2 ${
                    isFirstOfEvent ? "border-t-2" : ""
                  } ${isLastOfEvent ? "border-b-2" : ""}`
                : ""
            }`}
            style={{
              backgroundColor: mainEvent.color,
              opacity: zoneOpacity(mainEvent),
              borderTopLeftRadius: isFirstOfEvent ? 6 : 0,
              borderTopRightRadius: isFirstOfEvent ? 6 : 0,
              borderBottomLeftRadius: isLastOfEvent ? 6 : 0,
              borderBottomRightRadius: isLastOfEvent ? 6 : 0,
            }}
            title={eventTooltip(mainEvent)}
          >
            {isFirstOfEvent && (
              <span className="truncate">{eventLabel(mainEvent)}</span>
            )}
          </div>
        ) : placeholder ? (
          <div
            className={`absolute inset-0 flex items-center px-1 text-[10px] font-medium text-slate-500 bg-slate-200/80 border-dashed border-slate-400 border-x-2 ${
              isFirstOfPlaceholder ? "border-t-2 rounded-t-md" : ""
            } ${isLastOfPlaceholder ? "border-b-2 rounded-b-md" : ""}`}
            title={`${placeholder.period.label} — été ${placeholder.year} (libre)`}
          >
            {isFirstOfPlaceholder && (
              <span className="truncate">{placeholder.period.label}</span>
            )}
          </div>
        ) : holidayName ? (
          <span className="absolute inset-0 flex items-center px-1 text-[9px] text-red-500/90 pointer-events-none">
            <span className="truncate">{holidayName}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default memo(DayCellDesktop);
