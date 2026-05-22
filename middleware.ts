import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Cache en mémoire : userId → timestamp dernier UPDATE last_seen_at
// Évite les écritures DB redondantes au sein d'une même instance serveur
const lastSeenCache = new Map<string, number>();
const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Rafraîchit la session si elle existe
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tracking de la dernière visite (throttle 15 min, cache en mémoire)
  if (user) {
    const cached = lastSeenCache.get(user.id);
    const now = Date.now();

    if (!cached || now - cached > THROTTLE_MS) {
      // On met à jour en parallèle, sans bloquer la réponse
      lastSeenCache.set(user.id, now);
      supabase
        .from("users")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(() => {
          // Silencieux : si ça plante, on ne casse pas la navigation
        });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};