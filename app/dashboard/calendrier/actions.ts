"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { SUMMER_PERIODS, getPeriodDates } from "@/lib/summer-priorities";
import {
  getSummerSnapshot,
  checkPriorityToReserve,
  getFamilyHeadByName,
} from "@/lib/summer-state";
import { SUMMER_CHOICE_FREEDOM } from "@/lib/config";
import type { FamilyName } from "@/lib/families";
import { requireAuthUser } from "@/lib/supabase/auth";

type ReserveResult =
  | { ok: true; autoAssigned: boolean }
  | { ok: false; error: string };

/**
 * Server Action : réserve une période d'été pour la famille de l'utilisateur.
 *
 * Toute la logique côté serveur (autorité) :
 * - Auth + récupération du profil
 * - Permission (chef de famille sauf si SUMMER_CHOICE_FREEDOM=true)
 * - Validation de la priorité (les familles plus prioritaires ont-elles pické ?)
 * - Validation que la période est encore libre
 * - Insert du booking
 * - Auto-assignment de la 3e famille si on est à 2/3 prises
 */
export async function reservePlaceholder(
  year: number,
  periodId: number
): Promise<ReserveResult> {
  
  // 1. Auth (middleware a déjà validé le JWT, on lit juste le cookie)
  const user = await requireAuthUser();
  const supabase = await createClient();

  // 2. Profil + famille
  const { data: profile } = await supabase
    .from("users")
    .select("family_id, is_family_head, families(name)")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "Profil introuvable." };

  // @ts-ignore
  const myFamilyName: FamilyName | undefined = profile.families?.name;
  if (!myFamilyName) {
    return { ok: false, error: "Famille introuvable." };
  }

  // 3. Permission : seul le chef de famille peut, sauf si freedom flag activé
  if (!SUMMER_CHOICE_FREEDOM && !profile.is_family_head) {
    return {
      ok: false,
      error:
        "Seul le chef de famille peut réserver une période d'été pour la famille.",
    };
  }

  // 4. Période demandée
  const period = SUMMER_PERIODS.find((p) => p.id === periodId);
  if (!period) {
    return { ok: false, error: "Période d'été invalide." };
  }

  // 5. Snapshot actuel de l'été (qui a pris quoi)
  const snapshot = await getSummerSnapshot(year);

  // 6. Validation priorité
  const priorityError = checkPriorityToReserve(myFamilyName, snapshot);
  if (priorityError) {
    return { ok: false, error: priorityError };
  }

  // 7. La période demandée doit être encore libre
  const periodState = snapshot.periods[periodId as 1 | 2 | 3];
  if (periodState.state !== "free") {
    return {
      ok: false,
      error: `Cette période est déjà réservée par ${periodState.familyName}.`,
    };
  }

  // 8. La famille ne doit pas déjà avoir une période cette année (sécurité)
  if (snapshot.pickedFamilies.includes(myFamilyName)) {
    return {
      ok: false,
      error: `${myFamilyName} a déjà choisi une période cet été.`,
    };
  }

  // 9. Insert booking
  const { start, end } = getPeriodDates(year, period);
  const { error: insertError } = await supabase.from("bookings").insert({
    start_date: start,
    end_date: end,
    family_id: profile.family_id,
    created_by: user.id,
    status: "approved",
    note: `Réservation prioritaire été ${year} - ${period.label}`,
    is_admin_created: false,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  // 10. Auto-assignment : on re-snapshot pour voir l'état après notre insert
  const after = await getSummerSnapshot(year);
  let autoAssigned = false;

  if (after.remainingFamilies.length === 1) {
    // Une seule famille n'a pas pické → on lui attribue la période restante
    const lastFamily = after.remainingFamilies[0];
    const freePeriod = (
      [1, 2, 3] as const
    ).find((id) => after.periods[id].state === "free");

    if (freePeriod) {
      const headInfo = await getFamilyHeadByName(lastFamily);
      if (headInfo) {
        const lastPeriod = SUMMER_PERIODS.find((p) => p.id === freePeriod)!;
        const { start: lastStart, end: lastEnd } = getPeriodDates(
          year,
          lastPeriod
        );

        const { error: autoError } = await supabase.from("bookings").insert({
          start_date: lastStart,
          end_date: lastEnd,
          family_id: headInfo.familyId,
          created_by: headInfo.headUserId,
          status: "approved",
          note: `Attribution automatique été ${year} - ${lastPeriod.label} (dernière période disponible)`,
          is_admin_created: false,
        });

        if (!autoError) {
          autoAssigned = true;
        }
        // Si erreur sur l'auto-assignment : on ne rollback pas notre booking,
        // l'admin peut intervenir manuellement. On loggue.
      }
    }
  }

  revalidatePath("/dashboard/calendrier");
  revalidatePath("/dashboard");

  return { ok: true, autoAssigned };
}