import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { parseUserAgent } from "@/lib/user-agent";

/**
 * Cache module-level "best effort".
 *
 * ⚠️ Sur Vercel Edge, chaque cold start a son propre cache mémoire.
 * Donc le throttle n'est PAS respecté de manière stricte cross-instances :
 * un user peut déclencher 2-3 UPDATEs si le router Vercel le route sur des
 * instances froides différentes.
 *
 * Pour 14 users, c'est négligeable (qques UPDATEs en trop par jour). On évite
 * l'overkill d'une solution distribuée (KV/Redis).
 */
const lastSeenCache = new Map<string, number>();
const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

export async function middleware(
  request: NextRequest,
  event: NextFetchEvent
) {
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

  // Tracking de la dernière visite + device + geo (throttle 15 min)
  if (user) {
    const cached = lastSeenCache.get(user.id);
    const now = Date.now();

    if (!cached || now - cached > THROTTLE_MS) {
      lastSeenCache.set(user.id, now);

      // Parse user-agent
      const ua = request.headers.get("user-agent");
      const { device, os, browser } = parseUserAgent(ua);

      // Géoloc via Vercel headers
      const country = request.headers.get("x-vercel-ip-country") ?? null;
      const cityRaw = request.headers.get("x-vercel-ip-city") ?? null;
      const city = cityRaw ? decodeURIComponent(cityRaw) : null;
      const latRaw = request.headers.get("x-vercel-ip-latitude");
      const lngRaw = request.headers.get("x-vercel-ip-longitude");
      const lat = latRaw ? parseFloat(latRaw) : null;
      const lng = lngRaw ? parseFloat(lngRaw) : null;

      // UPDATE en arrière-plan via waitUntil :
      // la réponse part tout de suite au browser, mais l'UPDATE est garanti
      // d'arriver à terme (Vercel garde l'invocation vivante jusqu'à sa fin)
      event.waitUntil(
        supabase
          .from("users")
          .update({
            last_seen_at: new Date().toISOString(),
            last_device: device,
            last_os: os,
            last_browser: browser,
            last_country: country,
            last_city: city,
            last_lat: lat,
            last_lng: lng,
          })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) {
              console.error("[middleware] last_seen update failed:", error);
            }
          })
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};