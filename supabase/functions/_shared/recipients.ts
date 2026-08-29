// supabase/functions/_shared/recipients.ts
//
// Logique de destinataires partagée entre les 5 fonctions email.
//
// SESSION 3 (2026-06-14) : le filtre "utilisateurs déjà connectés"
// (last_sign_in_at) a été RETIRÉ. Il servait à ne pas spammer les 4 comptes
// jamais connectés ; ces comptes ayant été supprimés, le filtre n'a plus lieu
// d'être — et il deviendrait nuisible (il exclurait un nouveau membre tant
// qu'il ne s'est pas connecté).
//
// N.B. : `last_sign_in_at` reste disponible dans auth.users pour les stats
// admin/analytics. On ne retire QUE le filtrage des destinataires, pas la donnée.
//
// Trois patterns distincts :
//   - heads        : les 3 chefs de famille (new-booking, cancelled, reduced)
//   - authorAndHead: l'auteur + le chef de SA famille (decision)
//   - everyone     : tous les utilisateurs (digest)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

type SupabaseClient = ReturnType<typeof createClient>;

/** En test, tout part vers testEmail ; sinon la liste réelle (dédupliquée, sans vides). */
function applyTestMode(realEmails: string[], testMode: boolean, testEmail: string): string[] {
  if (testMode) return [testEmail];
  return Array.from(new Set(realEmails.filter(Boolean)));
}

/** Les 3 chefs de famille. */
export async function heads(
  supabase: SupabaseClient,
  testMode: boolean,
  testEmail: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("users")
    .select("email")
    .eq("is_family_head", true);
  const real = (data ?? []).map((h) => h.email as string);
  return applyTestMode(real, testMode, testEmail);
}

/** L'auteur d'une demande + le chef de sa famille, sans doublon. */
export async function authorAndHead(
  supabase: SupabaseClient,
  opts: { authorEmail: string; familyId: string },
  testMode: boolean,
  testEmail: string,
): Promise<string[]> {
  const { data: familyHead } = await supabase
    .from("users")
    .select("email")
    .eq("family_id", opts.familyId)
    .eq("is_family_head", true)
    .single();

  const real = new Set<string>();
  if (opts.authorEmail) real.add(opts.authorEmail);
  if (familyHead?.email) real.add(familyHead.email as string);
  return applyTestMode(Array.from(real), testMode, testEmail);
}

/** Tous les utilisateurs (digest). */
export async function everyone(
  supabase: SupabaseClient,
  testMode: boolean,
  testEmail: string,
): Promise<string[]> {
  const { data } = await supabase.from("users").select("email");
  const real = (data ?? []).map((u) => u.email as string);
  return applyTestMode(real, testMode, testEmail);
}

/**
 * Destinataires des rappels pratiques de la maison pour une famille (#40).
 *
 * Renvoie les LIGNES (prénom + e-mail) et non de simples adresses : le corps
 * de l'e-mail est nominatif (« Hello Vincent »), donc un envoi par personne.
 * Le mode test est appliqué par l'appelant, pour la même raison.
 *
 * ⚠️ `receives_house_alerts` et non `is_family_head` : ce dernier est vrai pour
 * CINQ personnes (Antoine, Claire, François, Vincent, Nelly) et gouverne le
 * DROIT DE VOTE sur les séjours. Repli sur les chefs quand même, si personne
 * n'est coché : un rappel qui n'arrive pas est pire qu'un rappel en double.
 */
export async function houseAlertRecipients(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{ email: string; display_name: string | null }[]> {
  const { data } = await supabase
    .from("users")
    .select("email, display_name, receives_house_alerts, is_family_head")
    .eq("family_id", familyId);

  const rows = data ?? [];
  const flagged = rows.filter((u) => u.receives_house_alerts);
  const chosen = flagged.length > 0 ? flagged : rows.filter((u) => u.is_family_head);

  return chosen.map((u) => ({
    email: u.email as string,
    display_name: (u.display_name as string | null) ?? null,
  }));
}
