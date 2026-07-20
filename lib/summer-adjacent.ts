// lib/summer-adjacent.ts
//
// Logique pure des « quinzaines de juin / septembre » (#39) — testée sans DB
// (esprit #34). Décalque de lib/ponts.ts.
//
// Règle : la famille qui occupe la Période 1 n'est pas prioritaire sur les
// 14 jours qui PRÉCÈDENT sa période ; celle qui occupe la Période 3 ne l'est
// pas sur les 14 jours qui la SUIVENT. Intention : empêcher d'enchaîner une
// plage continue de 5 semaines (juin→juillet ou août→septembre).
//
// ⚠️ La règle ne désigne AUCUNE famille prioritaire sur ces quinzaines, et
// aucun ordre de choix — seulement une famille non prioritaire. Le wording ne
// peut donc jamais renvoyer vers une autre famille (≠ ponts de mai, où le
// règlement nomme une priorité 1).
//
// Fenêtres ancrées sur les DATES RÉELLES des périodes, pas sur la quinzaine
// calendaire : depuis le modèle pivot (≥2027) le début de P1 est voté chaque
// année (SUMMER_PERIOD_1_START), une quinzaine figée raterait la cible.
//
// Purement advisory : AUCUN blocage nulle part (décision PO, cf.
// docs/specs/priority-card-profil.md). Seul l'été bloque.

import { addDays } from "./dates";
import {
  SUMMER_PERIODS,
  getPeriodDates,
  getPeriodRangeLabel,
  isSummerYearConfigured,
} from "./summer-priorities";

/** Longueur des fenêtres adjacentes, en jours (tranché 20 juil. 2026). */
export const ADJACENT_WINDOW_DAYS = 14;

/** "pre" = avant la Période 1 (juin) ; "post" = après la Période 3 (septembre). */
export type AdjacentWindowKind = "pre" | "post";

export type AdjacentWindow = {
  kind: AdjacentWindowKind;
  year: number;
  /** Période dont la fenêtre est adjacente : 1 (juin) ou 3 (septembre). */
  periodId: 1 | 3;
  /** Ex. « Période 1 ». */
  periodLabel: string;
  /** Ex. « 28 juin → 19 juillet », calculé depuis les vraies dates. */
  periodRange: string;
  /** Premier jour de la fenêtre, inclus. */
  start: string;
  /** Borne de fin : les NUITS de la fenêtre sont [start, end−1]. */
  end: string;
};

/**
 * Fenêtre « juin » : les 14 jours précédant le début de P1.
 * `end` = début de P1 → arriver pile ce jour-là ne prend aucune nuit de la
 * fenêtre (jour pivot autorisé).
 * null si l'année n'est pas configurée (≥2027 sans date votée) : on n'invente
 * pas de période, même précaution que le reste de l'app.
 */
export function getPreSummerWindow(year: number): AdjacentWindow | null {
  if (!isSummerYearConfigured(year)) return null;

  const p1 = SUMMER_PERIODS[0];
  const { start } = getPeriodDates(year, p1);

  return {
    kind: "pre",
    year,
    periodId: 1,
    periodLabel: p1.label,
    periodRange: getPeriodRangeLabel(year, p1),
    start: addDays(start, -ADJACENT_WINDOW_DAYS),
    end: start,
  };
}

/**
 * Fenêtre « septembre » : les 14 jours suivant la fin de P3.
 *
 * ⚠️ `end` de P3 n'a pas tout à fait le même sens selon le modèle (pivot ≥2027 :
 * jour de départ, semi-ouvert ; legacy ≤2026 : dernier jour occupé, inclusif).
 * On l'utilise tel quel comme borne : en legacy la fenêtre englobe donc une
 * nuit qui appartient encore à P3. Sans conséquence, car tout séjour chevauchant
 * réellement une période d'été est BLOQUÉ en amont par overlapsSummerPeriod et
 * n'atteint jamais cet advisory.
 */
export function getPostSummerWindow(year: number): AdjacentWindow | null {
  if (!isSummerYearConfigured(year)) return null;

  const p3 = SUMMER_PERIODS[2];
  const { end } = getPeriodDates(year, p3);

  return {
    kind: "post",
    year,
    periodId: 3,
    periodLabel: p3.label,
    periodRange: getPeriodRangeLabel(year, p3),
    start: end,
    end: addDays(end, ADJACENT_WINDOW_DAYS),
  };
}

/**
 * Un séjour « prend » une fenêtre s'il couvre au moins une NUIT de celle-ci
 * (même convention qu'en #38). Nuits d'un séjour = [start, end−1] ; nuits de la
 * fenêtre = [start, end−1]. Les jours pivots (partir le 1er jour, arriver le
 * dernier) ne prennent aucune nuit → pas de warning.
 */
export function stayTakesWindow(
  startISO: string,
  endISO: string,
  window: AdjacentWindow
): boolean {
  if (!startISO || !endISO || endISO <= startISO) return false; // 0 nuit
  const stayNightEnd = addDays(endISO, -1);
  const windowNightEnd = addDays(window.end, -1);
  return startISO <= windowNightEnd && window.start <= stayNightEnd;
}

/** Fenêtres adjacentes prises par un séjour, sur l'étendue d'années couverte. */
export function getAdjacentWindowsForRange(
  startISO: string,
  endISO: string
): AdjacentWindow[] {
  if (!startISO || !endISO || endISO <= startISO) return [];

  const startYear = Number(startISO.slice(0, 4));
  const endYear = Number(endISO.slice(0, 4));

  const windows: AdjacentWindow[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const pre = getPreSummerWindow(y);
    const post = getPostSummerWindow(y);
    if (pre) windows.push(pre);
    if (post) windows.push(post);
  }

  return windows.filter((w) => stayTakesWindow(startISO, endISO, w));
}

// ---------------------------------------------------------------------------
// Détenteurs des périodes (pur) — alimente les warnings
// ---------------------------------------------------------------------------

/** Séjour minimal nécessaire au calcul (mappé depuis la DB ailleurs). */
export type PeriodBooking = {
  family_name: string;
  start_date: string;
  end_date: string;
  status: string;
};

/** Familles détentrices de P1 et P3 (null si la période n'est pas attribuée). */
export type PeriodHolders = { 1: string | null; 3: string | null };

export type SummerAdjacentState = {
  year: number;
  holders: PeriodHolders;
};

/**
 * Qui détient P1 et P3 pour l'année.
 *
 * Gating par période et non sur les 3 : dès que P1 est attribuée, la contrainte
 * « son détenteur n'est pas prioritaire fin juin » est entièrement déterminée,
 * l'état de P2/P3 n'y change rien. Attendre 3/3 créerait un trou pile pendant
 * la fenêtre de réservation de janvier.
 *
 * ⚠️ Matching sur les dates canoniques EXACTES, comme getSummerSnapshot
 * (lib/summer-state.ts:54) : une P1 saisie 29 juin → 20 juillet au lieu du
 * canonique laisse la période non détectée → aucun warning cette année-là.
 * Piège hérité, documenté dans docs/specs/juin-septembre-warnings.md.
 *
 * Seul un séjour `approved` compte (décision #39, cohérente avec #38).
 */
export function buildPeriodHolders(
  year: number,
  bookings: PeriodBooking[]
): PeriodHolders {
  const holders: PeriodHolders = { 1: null, 3: null };
  if (!isSummerYearConfigured(year)) return holders;

  const approved = bookings.filter((b) => b.status === "approved");

  for (const periodId of [1, 3] as const) {
    const period = SUMMER_PERIODS.find((p) => p.id === periodId)!;
    const { start, end } = getPeriodDates(year, period);
    const match = approved.find(
      (b) => b.start_date === start && b.end_date === end
    );
    if (match) holders[periodId] = match.family_name;
  }

  return holders;
}

// ---------------------------------------------------------------------------
// Advisory
// ---------------------------------------------------------------------------

export type AdjacentAdvisory = {
  window: AdjacentWindow;
  /** Famille détentrice de la période adjacente (= la famille du séjour). */
  familyName: string;
};

/**
 * Warning si — et seulement si — la famille du séjour détient la période
 * adjacente à la fenêtre touchée. Les autres familles n'ont aucune contrainte
 * sur ces quinzaines (la P2 n'en a jamais).
 *
 * Même objet pour les deux surfaces (demandeur et validateur) : seule la copie
 * diffère, cf. components/SummerAdjacentAdvisory.tsx.
 *
 * null si le séjour ne touche aucune fenêtre, ou si sa famille ne détient pas
 * la période correspondante.
 */
export function computeAdjacentAdvisory(
  startISO: string,
  endISO: string,
  familyName: string,
  state: SummerAdjacentState
): AdjacentAdvisory | null {
  if (!familyName) return null;

  const windows = getAdjacentWindowsForRange(startISO, endISO).filter(
    (w) => w.year === state.year
  );

  for (const window of windows) {
    if (state.holders[window.periodId] === familyName) {
      return { window, familyName };
    }
  }

  return null;
}
