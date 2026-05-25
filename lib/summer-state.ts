import { createClient } from "@/lib/supabase/server";
import {
  SUMMER_PERIODS,
  getYearPriorities,
  getPeriodDates,
  type SummerPeriod,
} from "./summer-priorities";
import { FAMILIES, type FamilyName } from "./families";

export type PeriodStatus =
  | { state: "free"; period: SummerPeriod }
  | {
      state: "taken";
      period: SummerPeriod;
      familyName: FamilyName;
      familyId: string;
      bookingId: string;
    };

export type SummerSnapshot = {
  year: number;
  /** Pour chaque période 1/2/3, son statut (libre ou prise et par qui) */
  periods: { 1: PeriodStatus; 2: PeriodStatus; 3: PeriodStatus };
  /** Familles qui n'ont pas encore pické pour cette année */
  remainingFamilies: FamilyName[];
  /** Familles qui ont déjà pické (dans l'ordre de leur priorité) */
  pickedFamilies: FamilyName[];
};

/**
 * Récupère l'état des 3 périodes d'été pour une année donnée.
 * - Quelles périodes sont prises, par qui (avec family_id + booking_id pour pouvoir agir)
 * - Quelles familles n'ont pas encore pické
 *
 * Réutilisable par : Server Actions (reservePlaceholder), profil (priority card),
 * emails (savoir à qui notifier).
 */
export async function getSummerSnapshot(
  year: number
): Promise<SummerSnapshot> {
  const supabase = await createClient();

  // Fetch tous les bookings qui chevauchent l'été de cette année
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, family_id, families(name)")
    .in("status", ["pending", "approved"])
    .gte("start_date", `${year}-06-01`)
    .lte("end_date", `${year}-09-30`)
    .order("start_date");

  // Pour chaque période, on cherche si un booking matche pile ses dates
  const periods: Record<1 | 2 | 3, PeriodStatus> = {} as any;
  const pickedNames = new Set<string>();

  for (const period of SUMMER_PERIODS) {
    const { start, end } = getPeriodDates(year, period);

    const match = (bookings ?? []).find(
      (b: any) => b.start_date === start && b.end_date === end
    );

    if (match) {
      // @ts-ignore
      const familyName = match.families?.name as FamilyName;

      pickedNames.add(familyName);

      periods[period.id as 1 | 2 | 3] = {
        state: "taken",
        period,
        familyName,
        familyId: match.family_id,
        bookingId: match.id,
      };
    } else {
      periods[period.id as 1 | 2 | 3] = {
        state: "free",
        period,
      };
    }
  }

  const priorities = getYearPriorities(year);

  const allFamiliesInOrder: FamilyName[] = [
    priorities[1],
    priorities[2],
    priorities[3],
  ];

  const pickedFamilies = allFamiliesInOrder.filter((f) =>
    pickedNames.has(f)
  );

  const remainingFamilies = allFamiliesInOrder.filter(
    (f) => !pickedNames.has(f)
  );

  return {
    year,
    periods,
    pickedFamilies,
    remainingFamilies,
  };
}

/**
 * Vérifie si une famille peut RÉSERVER une période donnée maintenant.
 * Règle : il faut que toutes les familles avec une priorité supérieure aient
 * déjà pické.
 *
 * Renvoie null si OK, ou un message d'erreur si bloqué.
 */
export function checkPriorityToReserve(
  familyName: FamilyName,
  snapshot: SummerSnapshot
): string | null {
  const priorities = getYearPriorities(snapshot.year);

  const myPriority =
    priorities[1] === familyName
      ? 1
      : priorities[2] === familyName
      ? 2
      : priorities[3] === familyName
      ? 3
      : null;

  if (!myPriority) {
    return "Famille non reconnue dans la rotation été.";
  }

  // Vérifie que toutes les familles avec priorité < la mienne ont pické
  for (let p = 1; p < myPriority; p++) {
    const higherFam = priorities[p as 1 | 2 | 3];

    if (!snapshot.pickedFamilies.includes(higherFam)) {
      return `${higherFam} (priorité ${p}) doit d'abord choisir sa période.`;
    }
  }

  return null;
}

/**
 * Récupère family_id + user_id du chef d'une famille par son nom.
 * Utilisé pour l'auto-assignment de la prio 3.
 */
export async function getFamilyHeadByName(
  familyName: FamilyName
): Promise<{
  familyId: string;
  headUserId: string;
} | null> {
  const supabase = await createClient();

  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("name", familyName)
    .single();

  if (!family) return null;

  const { data: head } = await supabase
    .from("users")
    .select("id")
    .eq("family_id", family.id)
    .eq("is_family_head", true)
    .order("id")
    .limit(1)
    .maybeSingle();

  if (!head) return null;

  return {
    familyId: family.id,
    headUserId: head.id,
  };
}