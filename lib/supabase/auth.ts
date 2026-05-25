import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Récupère l'utilisateur authentifié.
 *
 * Utilise getSession() (lecture cookie locale, ~5ms) au lieu de getUser()
 * (round-trip Supabase, ~100ms). Safe parce que le middleware valide déjà
 * le JWT à chaque requête via getUser(). On ne fait QUE lire le cookie
 * qu'il a fraîchement validé.
 *
 * `cache()` dedupe les appels dans un même render path.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});

/**
 * Comme getAuthUser, mais redirige vers /login si non authentifié.
 * Helper pour les pages protégées.
 */
export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}