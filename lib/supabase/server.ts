import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { DEV_AUTH_BYPASS } from "./dev-bypass";

export async function createClient() {
  const cookieStore = await cookies();

  // Dev local (dev-bypass.ts) : sans session, la RLS bloque l'anon key. On passe
  // en service-role — SERVEUR UNIQUEMENT, jamais dans le bundle navigateur — pour
  // que les Server Components lisent les vraies données du Supabase hébergé.
  const supabaseKey = DEV_AUTH_BYPASS
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      auth: {
        flowType: "implicit",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component, ignorer
          }
        },
      },
    }
  );
}