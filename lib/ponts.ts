// lib/ponts.ts
//
// Logique pure des « ponts de mai » (#38) — testée sans DB (esprit #34).
//
// Rien dans le code ne modélisait un pont : lib/holidays.ts connaît les jours
// fériés, pas les week-ends prolongés. Ce module construit les fenêtres de pont
// à partir des fériés, dit quels ponts un séjour « prend », et centralise la
// règle de priorité (compensation de la priorité 3 été).
//
// Purement advisory : AUCUN blocage nulle part (décision PO, cf.
// docs/specs/priority-card-profil.md). Seul l'été bloque.

import { addDays, parseLocalDate } from "./dates";
import { getHolidaysForYear } from "./holidays";
import { getYearPriorities, type FamilyName } from "./summer-priorities";
import { FAMILY_NAMES } from "./families";

/**
 * Fériés retenus — les « ponts de mai » UNIQUEMENT (tranché 20 juil. 2026).
 * On identifie par NOM (shortName de lib/holidays.ts), pas par une fenêtre de
 * dates : Ascension/Pentecôte peuvent déborder sur début juin certaines années,
 * ils restent inclus. Pâques est hors périmètre.
 */
const MAY_PONT_SHORTNAMES = new Set(["1er Mai", "8 Mai", "Ascension", "Pentecôte"]);

export type Pont = {
  /** Clé stable dans l'année (= date de début ISO). */
  key: string;
  year: number;
  /** shortName(s) des fériés composant le pont (1, ou 2+ si fusion). */
  names: string[];
  /** Libellé lisible, ex. « pont de l'Ascension ». */
  label: string;
  /** Premier jour du pont, ISO YYYY-MM-DD, inclus. */
  start: string;
  /** Dernier jour du pont, ISO YYYY-MM-DD, inclus. */
  end: string;
};

/**
 * Fenêtre du pont selon le jour de semaine du férié (tranché 20 juil. 2026) :
 *   jeudi   → jeu → dim (Ascension, toujours)
 *   vendredi→ ven → dim
 *   lundi   → sam → lun (Pentecôte, toujours)
 *   mardi   → sam → mar
 *   mer/sam/dim → pas de pont
 * Renvoie null si le férié ne crée pas de pont.
 */
function pontWindow(holidayISO: string): { start: string; end: string } | null {
  const dow = parseLocalDate(holidayISO).getDay(); // 0 dim … 6 sam
  switch (dow) {
    case 4: // jeudi
      return { start: holidayISO, end: addDays(holidayISO, 3) };
    case 5: // vendredi
      return { start: holidayISO, end: addDays(holidayISO, 2) };
    case 1: // lundi
      return { start: addDays(holidayISO, -2), end: holidayISO };
    case 2: // mardi
      return { start: addDays(holidayISO, -3), end: holidayISO };
    default:
      return null;
  }
}

/** Article correct par férié : « de l'Ascension », « du 1er Mai »… */
function pontConnector(shortName: string): string {
  switch (shortName) {
    case "Ascension":
      return "de l'Ascension";
    case "Pentecôte":
      return "de Pentecôte";
    case "1er Mai":
      return "du 1er Mai";
    case "8 Mai":
      return "du 8 Mai";
    default:
      return `de ${shortName}`;
  }
}

function pontLabel(names: string[]): string {
  return `pont ${names.map(pontConnector).join(" et ")}`;
}

/**
 * Fusionne les fenêtres qui se chevauchent en un seul pont à double nom
 * (rare : Ascension proche du 8 mai selon l'année). Attend une liste triée par
 * `start`. Pur et exporté pour être testé directement.
 */
export function mergeOverlappingPonts(ponts: Pont[]): Pont[] {
  if (ponts.length <= 1) return ponts;
  const merged: Pont[] = [ponts[0]];
  for (let i = 1; i < ponts.length; i++) {
    const cur = merged[merged.length - 1];
    const next = ponts[i];
    // Chevauchement de fenêtres [start,end] inclusives (liste triée par start).
    if (next.start <= cur.end) {
      const names = [...cur.names, ...next.names];
      const end = next.end > cur.end ? next.end : cur.end;
      merged[merged.length - 1] = {
        ...cur,
        names,
        end,
        label: pontLabel(names),
      };
    } else {
      merged.push(next);
    }
  }
  return merged;
}

/**
 * Les ponts de mai d'une année, dans l'ordre chronologique. Calcul pur sur
 * date-holidays (déjà en dépendance) : couvre les années arbitraires, aucune
 * config d'année contrairement à l'été (SUMMER_PERIOD_1_START).
 */
export function getMayPonts(year: number): Pont[] {
  const raw = getHolidaysForYear(year)
    .filter((h) => MAY_PONT_SHORTNAMES.has(h.shortName))
    .map((h) => ({ shortName: h.shortName, window: pontWindow(h.date) }))
    .filter((h): h is { shortName: string; window: { start: string; end: string } } => h.window !== null)
    .map(({ shortName, window }) => ({
      key: window.start,
      year,
      names: [shortName],
      label: pontLabel([shortName]),
      start: window.start,
      end: window.end,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  return mergeOverlappingPonts(raw);
}

/**
 * Un séjour « prend » un pont s'il couvre au moins une NUIT du pont (tranché
 * 20 juil. 2026). Nuits d'un séjour = [start, end−1] (chaque nuit rattachée à
 * son jour de coucher) ; nuits d'un pont = [pStart, pEnd−1]. Les jours pivots
 * (partir le 1er jour, arriver le dernier) ne prennent aucune nuit → pas de
 * warning.
 */
export function stayTakesPont(
  startISO: string,
  endISO: string,
  pont: Pont
): boolean {
  if (!startISO || !endISO || endISO <= startISO) return false; // 0 nuit
  const stayNightEnd = addDays(endISO, -1);
  const pontNightEnd = addDays(pont.end, -1);
  // Intersection non vide de deux plages de nuits inclusives (ISO ↔ ordre).
  return startISO <= pontNightEnd && pont.start <= stayNightEnd;
}

/** Quels ponts de mai un séjour chevauche (nuits), sur l'étendue d'années couverte. */
export function getPontsForRange(startISO: string, endISO: string): Pont[] {
  if (!startISO || !endISO || endISO <= startISO) return [];
  const startYear = Number(startISO.slice(0, 4));
  const endYear = Number(endISO.slice(0, 4));
  const ponts: Pont[] = [];
  for (let y = startYear; y <= endYear; y++) ponts.push(...getMayPonts(y));
  return ponts.filter((p) => stayTakesPont(startISO, endISO, p));
}

/**
 * Famille prioritaire sur les ponts de mai de l'année Y = priorité 3 de l'été Y
 * (compensation de l'été subi). Même année calendaire (tranché 20 juil. 2026).
 * Source unique consommée par PriorityCard ET les warnings.
 */
export function getPontPriorityFamily(year: number): FamilyName {
  return getYearPriorities(year)[3];
}

// ---------------------------------------------------------------------------
// État des ponts d'une année (pur) — alimente les warnings demandeur/validateur
// ---------------------------------------------------------------------------

export type PontClaimStatus = "pending" | "approved";

/** Séjour minimal nécessaire au calcul d'état (mappé depuis la DB ailleurs). */
export type PontBooking = {
  family_id: string;
  family_name: string;
  start_date: string;
  end_date: string;
  status: PontClaimStatus;
};

export type PontClaim = {
  familyId: string;
  familyName: string;
  status: PontClaimStatus;
};

export type PontState = {
  pont: Pont;
  /** Familles qui prennent ce pont (approved ou pending). */
  claims: PontClaim[];
};

/** État de chaque pont de mai de l'année à partir des séjours actifs. */
export function buildPontsState(
  year: number,
  bookings: PontBooking[]
): PontState[] {
  return getMayPonts(year).map((pont) => ({
    pont,
    claims: bookings
      .filter((b) => stayTakesPont(b.start_date, b.end_date, pont))
      .map((b) => ({
        familyId: b.family_id,
        familyName: b.family_name,
        status: b.status,
      })),
  }));
}

/** Nombre de ponts APPROVED par famille (un pont compte une fois par famille). */
function approvedPontCountByFamily(state: PontState[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of state) {
    const approvedFams = new Set(
      s.claims.filter((c) => c.status === "approved").map((c) => c.familyName)
    );
    for (const f of approvedFams) counts[f] = (counts[f] ?? 0) + 1;
  }
  return counts;
}

/** Premier pont où la famille a une demande PENDING (mention informative), ou null. */
function firstPendingPontLabel(
  state: PontState[],
  familyName: string
): string | null {
  for (const s of state) {
    if (
      s.claims.some((c) => c.familyName === familyName && c.status === "pending")
    ) {
      return s.pont.label;
    }
  }
  return null;
}

export type DemanderPontAdvisory = {
  year: number;
  /** Ponts que le séjour demandé chevauche. */
  ponts: Pont[];
  priorityFamily: FamilyName;
  /** La famille prioritaire a-t-elle déjà un pont approved (priorité consommée) ? */
  priorityChosen: boolean;
  /** Pont demandé (pending) par la famille prioritaire, à mentionner. */
  priorityPendingLabel: string | null;
  /** Cas A — pas prioritaire, et la prioritaire n'a pas encore choisi. */
  caseA: boolean;
  /** Cas C — info positive, tu es la famille prioritaire. */
  caseC: boolean;
  /** Cas B — équité : tu prendrais un 2e pont alors qu'une famille n'en a aucun. */
  caseB: {
    /** true si les ponts déjà tenus sont approved (sinon = pris par CETTE demande). */
    alreadyApproved: boolean;
    heldLabels: string[];
    deprived: string[];
  } | null;
};

/**
 * Warnings pour le DEMANDEUR (NewBookingForm). null si le séjour ne prend aucun
 * pont. Les cas peuvent se cumuler (A+B). Tous non bloquants.
 */
export function computeDemanderPontAdvisory(
  startISO: string,
  endISO: string,
  myFamilyName: string,
  state: PontState[]
): DemanderPontAdvisory | null {
  const ponts = state
    .filter((s) => stayTakesPont(startISO, endISO, s.pont))
    .map((s) => s.pont);
  if (ponts.length === 0) return null;

  const year = ponts[0].year;
  const priorityFamily = getPontPriorityFamily(year);
  const counts = approvedPontCountByFamily(state);
  const priorityChosen = (counts[priorityFamily] ?? 0) >= 1;
  const priorityPendingLabel = firstPendingPontLabel(state, priorityFamily);

  const isMinePriority = myFamilyName === priorityFamily;
  const caseA = !isMinePriority && !priorityChosen;
  const caseC = isMinePriority && !priorityChosen;

  // Cas B — équité. « Tenus » = ponts approved + ponts pris par CETTE demande
  // (un séjour couvrant 2 ponts compte comme 2 pris, cf. cas limites). Une
  // simple prolongation sur le même pont ne déclenche pas B (union inchangée).
  const myApprovedPonts = state
    .filter((s) =>
      s.claims.some((c) => c.familyName === myFamilyName && c.status === "approved")
    )
    .map((s) => s.pont);
  const heldKeys = new Set([
    ...myApprovedPonts.map((p) => p.key),
    ...ponts.map((p) => p.key),
  ]);
  const deprived = FAMILY_NAMES.filter(
    (f) => f !== myFamilyName && (counts[f] ?? 0) === 0
  );

  let caseB: DemanderPontAdvisory["caseB"] = null;
  if (heldKeys.size >= 2 && deprived.length > 0) {
    const alreadyApproved = myApprovedPonts.length >= 1;
    caseB = {
      alreadyApproved,
      heldLabels: (alreadyApproved ? myApprovedPonts : ponts).map((p) => p.label),
      deprived: [...deprived],
    };
  }

  return {
    year,
    ponts,
    priorityFamily,
    priorityChosen,
    priorityPendingLabel,
    caseA,
    caseC,
    caseB,
  };
}

export type ValidatorPontAdvisory = {
  year: number;
  ponts: Pont[];
  priorityFamily: FamilyName;
  priorityChosen: boolean;
  priorityPendingLabel: string | null;
  /** Ponts déjà pris (approved) → famille. */
  takenPonts: { label: string; family: string }[];
};

/**
 * Contexte FACTUEL pour les validateurs (BookingDetailModal). Aucune reco
 * d'accepter/refuser — juste les faits, la famille décide. null si le séjour ne
 * prend aucun pont.
 */
export function computeValidatorPontAdvisory(
  startISO: string,
  endISO: string,
  state: PontState[]
): ValidatorPontAdvisory | null {
  const ponts = state
    .filter((s) => stayTakesPont(startISO, endISO, s.pont))
    .map((s) => s.pont);
  if (ponts.length === 0) return null;

  const year = ponts[0].year;
  const priorityFamily = getPontPriorityFamily(year);
  const counts = approvedPontCountByFamily(state);
  const priorityChosen = (counts[priorityFamily] ?? 0) >= 1;
  const priorityPendingLabel = firstPendingPontLabel(state, priorityFamily);

  const takenPonts: { label: string; family: string }[] = [];
  for (const s of state) {
    const approved = s.claims.find((c) => c.status === "approved");
    if (approved) takenPonts.push({ label: s.pont.label, family: approved.familyName });
  }

  return { year, ponts, priorityFamily, priorityChosen, priorityPendingLabel, takenPonts };
}
