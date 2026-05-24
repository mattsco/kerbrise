/**
 * Logique métier pour la bannière contextuelle du dashboard.
 * Pas de JSX, juste du calcul.
 */

import { parseLocalDate, daysBetween, todayISO } from "./dates";

export type UpcomingBooking = {
  id: string;
  start_date: string;
  end_date: string;
  family_id: string;
  family_name: string;
  family_color: string;
};

export type BannerCase = "A" | "B" | "C" | "D";

export type BannerContext = {
  bannerCase: BannerCase;
  currentlyAt: UpcomingBooking | null;
  myFamilyNextStay: UpcomingBooking | null;
  relayBooking: UpcomingBooking | null;
  relayDiffDays: number;
};


export function computeBannerContext(
  allUpcoming: UpcomingBooking[],
  myFamilyId: string,
  todayISO: string
): BannerContext {
  // Qui est à Kerbrise maintenant ?
  const currentlyAt =
    allUpcoming.find(
      (b) => b.start_date <= todayISO && b.end_date >= todayISO
    ) ?? null;

  // Mon prochain séjour (= ma famille, dans le futur)
  const myFamilyNextStay =
    allUpcoming.find(
      (b) => b.family_id === myFamilyId && b.start_date > todayISO
    ) ?? null;

  // Si ma famille est en séjour ou j'ai un prochain séjour, regarde le relais
  const myActiveOrNextStay =
    currentlyAt?.family_id === myFamilyId ? currentlyAt : myFamilyNextStay;

  let relayBooking: UpcomingBooking | null = null;
  let relayDiffDays = 0;

  if (myActiveOrNextStay) {
  const myEnd = myActiveOrNextStay.end_date;
  relayBooking =
    allUpcoming.find((b) => {
      if (b.family_id === myFamilyId) return false;
      const gap = daysBetween(myEnd, b.start_date);
      return gap > 0 && gap <= 10;
    }) ?? null;

  if (relayBooking) {
    relayDiffDays = daysBetween(myEnd, relayBooking.start_date);
  }
}

  // Détermine le cas
  let bannerCase: BannerCase;
  if (currentlyAt && currentlyAt.family_id === myFamilyId) {
    bannerCase = "A";
  } else if (currentlyAt) {
    bannerCase = "B";
  } else if (myFamilyNextStay) {
    bannerCase = "C";
  } else {
    bannerCase = "D";
  }

  return {
    bannerCase,
    currentlyAt,
    myFamilyNextStay,
    relayBooking,
    relayDiffDays,
  };
}

// ===========================
// FORMATTERS
// ===========================

export function getRelayPhrase(diffDays: number, familyName: string): string {
  if (diffDays === 0) return `${familyName} arrive le jour de ton départ`;
  if (diffDays === 1) return `${familyName} arrive le lendemain de ton départ`;
  return `${familyName} arrive ${diffDays} jours après ton départ`;
}

export function getRelativeFromNow(isoDate: string): string {
  const diffDays = daysBetween(todayISO(), isoDate);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "demain";
  if (diffDays < 14) return `dans ${diffDays} jours`;
  if (diffDays < 60) return `dans ${Math.round(diffDays / 7)} semaines`;
  return `dans ${Math.round(diffDays / 30)} mois`;
}


export function formatEndDate(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}


export function getDaysRemaining(endIso: string): number {
  return daysBetween(todayISO(), endIso);
}


export function formatRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sShort = s.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const eShort = e.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  if (sameMonth && sameYear) return `${s.getDate()} → ${eShort}`;
  return `${sShort} → ${eShort}`;
}