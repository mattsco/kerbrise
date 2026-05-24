"use client";

import type { Placeholder } from "@/lib/summer-placeholders";

import {
  dateToISO,
  isSameDay,
} from "./calendar-utils";

export type CalendarEvent = {
  id: string;
  bookingId: string;

  start_date: string;
  end_date: string;

  family_id: string;
  family_name: string;

  color: string;

  status: "pending" | "approved";
};

type Props = {
  dayNum: number;

  date: Date;
  dateStr: string;

  today: Date;

  isSpecialDay: boolean;
  isSelected: boolean;

  dayEvents: CalendarEvent[];

  placeholder?: Placeholder;

  onDayClick: (
    dateStr: string,
    hasEvent: boolean,
    eventBookingId?: string,
    placeholder?: Placeholder
  ) => void;

  onDayHover: (
    dateStr: string
  ) => void;
};

function getFamilyShortName(
  familyName: string
) {
  return familyName
    ?.trim()
    ?.charAt(0)
    ?.toUpperCase();
}

export default function CalendarDayCell({
  dayNum,
  date,
  dateStr,
  today,
  isSpecialDay,
  isSelected,
  dayEvents,
  placeholder,
  onDayClick,
  onDayHover,
}: Props) {
  const todayStr =
    dateToISO(today);

  const isToday = isSameDay(
    date,
    today
  );

  const isPast =
    dateStr < todayStr;

  const endingEvent =
    dayEvents.find(
      (e) =>
        e.end_date ===
        dateStr
    );

  const startingEvent =
    dayEvents.find(
      (e) =>
        e.start_date ===
        dateStr
    );

  const isPivot =
    !!endingEvent &&
    !!startingEvent &&
    endingEvent.bookingId !==
      startingEvent.bookingId;

  const mainEvent =
    dayEvents[0];

  const isFirstOfPlaceholder =
    placeholder?.startDate ===
    dateStr;

  const isLastOfPlaceholder =
    placeholder?.endDate ===
    dateStr;

  function handleClick() {
    if (
      isPivot &&
      startingEvent
    ) {
      onDayClick(
        dateStr,
        true,
        startingEvent.bookingId
      );

      return;
    }

    if (mainEvent) {
      onDayClick(
        dateStr,
        true,
        mainEvent.bookingId
      );

      return;
    }

    onDayClick(
      dateStr,
      false,
      undefined,
      placeholder
    );
  }

  return (
    <div
      className={`
        h-[52px] relative cursor-pointer rounded
        ${
          isSpecialDay &&
          !isSelected
            ? "bg-slate-50"
            : ""
        }
      `}
      onClick={handleClick}
      onMouseEnter={() =>
        onDayHover(dateStr)
      }
    >
      {/* Numéro du jour */}
      <div
        className={`
          absolute top-1 left-1/2 -translate-x-1/2
          min-w-[28px] h-7 flex items-center justify-center
          text-xs rounded-full
          z-[1]

          ${
            isToday
              ? "font-bold text-slate-900 bg-slate-100"
              : ""
          }

          ${
            !isToday &&
            isPast
              ? "text-slate-300"
              : ""
          }

          ${
            !isToday &&
            !isPast
              ? "text-slate-900"
              : ""
          }
        `}
      >
        {dayNum}
      </div>

      {/* Sélection en cours */}
      {isSelected &&
        dayEvents.length ===
          0 && (
          <div className="absolute inset-0 bg-blue-100/60 rounded" />
        )}

      {/* Placeholder été */}
      {placeholder && (
        <div
          className="
            absolute bottom-1 left-0 right-0 h-6
            text-[11px] text-slate-500 font-medium
            flex items-center px-1.5 truncate
            bg-slate-200/80
            border-2 border-dashed border-slate-400
            z-[2]
          "
          style={{
            borderTopLeftRadius:
              isFirstOfPlaceholder
                ? 12
                : 0,

            borderBottomLeftRadius:
              isFirstOfPlaceholder
                ? 12
                : 0,

            borderTopRightRadius:
              isLastOfPlaceholder
                ? 12
                : 0,

            borderBottomRightRadius:
              isLastOfPlaceholder
                ? 12
                : 0,

            borderLeftWidth:
              isFirstOfPlaceholder
                ? 2
                : 0,

            borderRightWidth:
              isLastOfPlaceholder
                ? 2
                : 0,

            marginLeft:
              isFirstOfPlaceholder
                ? 4
                : 0,

            marginRight:
              isLastOfPlaceholder
                ? 4
                : 0,
          }}
        >
          {isFirstOfPlaceholder && (
            <span className="truncate">
              {
                placeholder
                  .period
                  .label
              }
            </span>
          )}
        </div>
      )}

      {/* === EVENTS === */}

      {isPivot &&
      endingEvent &&
      startingEvent ? (
        <>
          {/* Fin booking */}
          <div
            className={`
              absolute bottom-1 left-0 w-1/2 h-6 z-[2]
              ${
                endingEvent.status ===
                "pending"
                  ? "border-y-2 border-l-2 border-dashed border-white/70"
                  : ""
              }
            `}
            style={{
              backgroundColor:
                endingEvent.color,

              opacity:
                endingEvent.status ===
                "pending"
                  ? 0.75
                  : 1,

              borderTopRightRadius: 12,
              borderBottomRightRadius: 12,
            }}
          />

          {/* Début booking */}
          <div
            className={`
              absolute bottom-1 right-0 w-1/2 h-6
              text-[11px] text-white font-medium
              flex items-center px-1.5 truncate
              z-[2]

              ${
                startingEvent.status ===
                "pending"
                  ? "border-y-2 border-r-2 border-dashed border-white/70"
                  : ""
              }
            `}
            style={{
              backgroundColor:
                startingEvent.color,

              opacity:
                startingEvent.status ===
                "pending"
                  ? 0.75
                  : 1,

              borderTopLeftRadius: 12,
              borderBottomLeftRadius: 12,
            }}
          >
            <span className="truncate">
              {getFamilyShortName(
                startingEvent.family_name
              )}

              {startingEvent.status ===
              "pending"
                ? " ⏳"
                : ""}
            </span>
          </div>
        </>
      ) : mainEvent ? (
        (() => {
          const isFirstOfEvent =
            mainEvent.start_date ===
            dateStr;

          const isLastOfEvent =
            mainEvent.end_date ===
            dateStr;

          return (
            <div
              className={`
                absolute bottom-1 left-0 right-0 h-6
                text-[11px] text-white font-medium
                flex items-center px-1.5 truncate
                z-[2]

                ${
                  mainEvent.status ===
                  "pending"
                    ? `
                      border-y-2 border-dashed border-white/70
                      ${isFirstOfEvent ? "border-l-2" : "border-l-0"}
                      ${isLastOfEvent ? "border-r-2" : "border-r-0"}
                    `
                    : ""
                }
              `}
              style={{
                backgroundColor:
                  mainEvent.color,

                opacity:
                  mainEvent.status ===
                  "pending"
                    ? 0.75
                    : 1,

                borderTopLeftRadius:
                  isFirstOfEvent
                    ? 12
                    : 0,

                borderBottomLeftRadius:
                  isFirstOfEvent
                    ? 12
                    : 0,

                borderTopRightRadius:
                  isLastOfEvent
                    ? 12
                    : 0,

                borderBottomRightRadius:
                  isLastOfEvent
                    ? 12
                    : 0,

                marginLeft:
                  isFirstOfEvent
                    ? 4
                    : 0,

                marginRight:
                  isLastOfEvent
                    ? 4
                    : 0,
              }}
            >
              {isFirstOfEvent && (
                <span className="truncate">
                  {getFamilyShortName(
                    mainEvent.family_name
                  )}

                  {mainEvent.status ===
                  "pending"
                    ? " ⏳"
                    : ""}
                </span>
              )}
            </div>
          );
        })()
      ) : null}
    </div>
  );
}