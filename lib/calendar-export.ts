// lib/calendar-export.ts
//
// Construction d'un événement "journée entière" pour Google Agenda (URL) ou
// un fichier .ics (Apple/Outlook/…), à partir d'un séjour Kerbrise.
//
// Toute la rédaction de l'événement (titre, lieu, description) vit ici, dans
// buildStayCalendarEvent() : un seul endroit à retoucher pour le ton/visuel.
// googleCalendarUrl() et icsContent() restent génériques.
//
// Convention de dates : start/end sont INCLUSIFS et alignés sur l'affichage
// de l'app (un séjour "du 15 au 28" = 14 jours, daysInRangeInclusive). Or un
// événement journée entière a une fin EXCLUSIVE (iCal/Google), d'où le +1 jour
// sur la date de fin. Si le jour de départ ne doit PAS être couvert (départ le
// matin), il suffira de retirer ce +1 dans addDaysISO(e.endDate, 1).

import { parseLocalDate, daysInRangeInclusive } from "@/lib/dates";

export type CalendarEventInput = {
  title: string;
  /** ISO YYYY-MM-DD, inclusif. */
  startDate: string;
  /** ISO YYYY-MM-DD, inclusif (converti en fin exclusive ci-dessous). */
  endDate: string;
  location?: string;
  description?: string;
};

// ---------------------------------------------------------------------------
// Construction de l'événement "séjour" (le seul endroit où vit le libellé)
// ---------------------------------------------------------------------------

export type StayInfo = {
  familyName: string;
  /** ISO YYYY-MM-DD, inclusif. */
  startDate: string;
  /** ISO YYYY-MM-DD, inclusif. */
  endDate: string;
  authorName: string;
};

/** Maison partagée — affiché dans le champ Lieu de l'agenda. */
const HOUSE_LOCATION = "Kerbrise, Saint-Malo, France";

/**
 * "lundi 15 juin 2026" — heure LOCALE (parseLocalDate, pas new Date(iso))
 * pour éviter le décalage d'un jour à Paris en hiver, comme le reste de l'app.
 */
function humanDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Événement "séjour" prêt à exporter, avec un libellé chaleureux.
 * C'est ICI qu'on ajuste le titre, le lieu et le texte de la description.
 */
export function buildStayCalendarEvent(stay: StayInfo): CalendarEventInput {
  const days = daysInRangeInclusive(stay.startDate, stay.endDate);

  const description = [
    `☀️ Séjour de la famille ${stay.familyName} à Kerbrise.`,
    "",
    `📅 Du ${humanDate(stay.startDate)}`,
    `       au ${humanDate(stay.endDate)} — ${days} jour${days > 1 ? "s" : ""}.`,
    `👤 Demandé par ${stay.authorName}.`,
    "",
    "Bon séjour à Saint-Malo ! 🌊",
  ].join("\n");

  return {
    title: "Séjour Kerbrise ☀️",
    startDate: stay.startDate,
    endDate: stay.endDate,
    location: HOUSE_LOCATION,
    description,
  };
}

// ---------------------------------------------------------------------------
// Sérialisation Google Agenda / .ics (génériques)
// ---------------------------------------------------------------------------

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
