import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Récupère l'utilisateur authentifié.
 *
 * Utilise getClaims() : vérifie la signature du JWT LOCALEMENT via la clé
 * publique ES256 (JWKS en cache mémoire), sans round-trip vers le serveur Auth
 * (~0ms). Remplace l'ancien getSession() qui lisait le cookie sans en vérifier
 * la signature (d'où les warnings "insecure" de Supabase). On a maintenant la
 * vitesse ET la validation cryptographique.
 *
 * On ne renvoie que { id, email } : les seuls champs consommés par les pages.
 *
 * `cache()` dedupe les appels dans un même render path.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub, email: claims.email };
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