import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase « service role » — BYPASSE la RLS.
 *
 * ⚠️ À n'importer QUE depuis des route handlers / server actions, jamais dans du
 * code qui pourrait finir côté client (`import "server-only"` lève sinon au build).
 * Première introduction de la service key dans le codebase (cf. spec TRMNL D4) :
 * grep `SERVICE_ROLE` à chaque revue. Lit `SUPABASE_SERVICE_ROLE_KEY` (env Vercel).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service env manquante (URL / SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
