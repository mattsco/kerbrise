// lib/supabase/dev-bypass.ts
//
// Bypass d'authentification pour le DÉVELOPPEMENT LOCAL uniquement.
//
// Permet d'ouvrir l'app en `npm run dev` sans passer par /login, en
// « incarnant » un vrai utilisateur. Comme l'app parle au Supabase HÉBERGÉ
// (pas de stack local) et que les tables sont protégées par RLS, le client
// serveur bascule sur la clé service-role dans ce mode → les Server Components
// lisent les vraies données.
//
// ⚠️⚠️ SÉCURITÉ — double verrou, impossible à activer en prod :
//   1. process.env.NODE_ENV === "development"  (Vercel build = "production")
//   2. process.env.DEV_LOGIN_BYPASS === "true" (flag explicite, dans .env.local
//      gitignoré — jamais commité, jamais présent en prod)
// La clé service-role n'est lue QUE côté serveur (lib/supabase/server.ts) et
// n'atteint JAMAIS le bundle navigateur.
//
// Limite connue : les fetchs faits CÔTÉ CLIENT (browser client, anon key) —
// calendrier interactif, snapshot ponts du formulaire — restent soumis à la RLS
// et n'auront pas de données sans vraie session. Le bypass couvre le rendu
// server-side (pages, props), pas l'auth navigateur.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** true seulement en dev local avec le flag explicite. Jamais vrai en prod. */
export const DEV_AUTH_BYPASS =
  process.env.NODE_ENV === "development" &&
  process.env.DEV_LOGIN_BYPASS === "true";

type DevUser = { id: string; email: string | undefined };

let cached: DevUser | null = null;
let warned = false;

/**
 * Utilisateur incarné en mode bypass. Résolu via l'API admin (service-role) :
 * DEV_USER_EMAIL si fourni, sinon le premier utilisateur. Mis en cache.
 * Renvoie null hors mode bypass ou si aucun utilisateur.
 */
export async function getDevBypassUser(): Promise<DevUser | null> {
  if (!DEV_AUTH_BYPASS) return null;
  if (cached) return cached;

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error || !data?.users?.length) {
    console.error("[dev-bypass] impossible de lister les utilisateurs :", error);
    return null;
  }

  // Priorité : DEV_USER_ID (clé de jointure avec public.users, la plus fiable),
  // puis DEV_USER_EMAIL, puis le premier utilisateur. ⚠️ « premier » peut ne pas
  // avoir de profil public.users → cibler explicitement un membre de la famille.
  const wantedId = process.env.DEV_USER_ID;
  const wantedEmail = process.env.DEV_USER_EMAIL?.toLowerCase();
  const picked = wantedId
    ? data.users.find((u) => u.id === wantedId)
    : wantedEmail
      ? data.users.find((u) => u.email?.toLowerCase() === wantedEmail)
      : data.users[0];

  if (!picked) {
    console.error(
      `[dev-bypass] aucun utilisateur pour DEV_USER_ID="${wantedId ?? ""}" / DEV_USER_EMAIL="${wantedEmail ?? ""}".`
    );
    return null;
  }

  cached = { id: picked.id, email: picked.email };

  if (!warned) {
    warned = true;
    console.warn(
      `\n⚠️  [DEV] Bypass d'authentification ACTIF — incarné : ${picked.email} (${picked.id}).\n` +
        `    Client serveur en service-role (RLS contournée). NE JAMAIS activer en prod.\n`
    );
  }

  return cached;
}
