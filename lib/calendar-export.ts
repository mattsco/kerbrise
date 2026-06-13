// lib/calendar-export.ts
//
// Construction d'un événement "tout au long de la journée" pour Google
// Agenda (URL) ou un fichier .ics (Apple/Outlook/…), à partir d'un séjour.
//
// Convention de dates : start/end sont INCLUSIFS et alignés sur l'affichage
// de l'app (un séjour "du 15 au 28" = 14 jours, daysInRangeInclusive). Or un
// événement journée entière a une fin EXCLUSIVE (iCal/Google), d'où le +1 jour
// sur la date de fin. Si le jour de départ ne doit PAS être couvert (départ le
// matin), il suffira de retirer ce +1.

import { parseLocalDate } from "@/lib/dates";

export type CalendarEventInput = {
  title: string;
  /** ISO YYYY-MM-DD, inclusif. */
  startDate: string;
  /** ISO YYYY-MM-DD, inclusif (converti en fin exclusive ci-dessous). */
  endDate: string;
  location?: string;
  description?: string;
};

/** "2026-06-15" → "20260615" */
function compact(iso: string): string {
  return iso.replace(/-/g, "");
}

/** Date ISO décalée de `days` jours (gère les fins de mois via Date). */
function addDaysISO(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** URL Google Agenda (modèle pré-rempli, événement journée entière). */
export function googleCalendarUrl(e: CalendarEventInput): string {
  const start = compact(e.startDate);
  const endExclusive = compact(addDaysISO(e.endDate, 1));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${start}/${endExclusive}`,
  });
  if (e.location) params.set("location", e.location);
  if (e.description) params.set("details", e.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Contenu d'un fichier .ics (RFC 5545) pour un événement journée entière. */
export function icsContent(e: CalendarEventInput): string {
  const start = compact(e.startDate);
  const endExclusive = compact(addDaysISO(e.endDate, 1));
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${start}-${endExclusive}-${stamp}@kerbrise`;
  const esc = (s: string) =>
    s.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kerbrise//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${endExclusive}`,
    `SUMMARY:${esc(e.title)}`,
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
