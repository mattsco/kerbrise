import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { parseUserAgent } from "@/lib/user-agent";

// Cache en mémoire : userId → timestamp dernier UPDATE
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
      const country =
        request.headers.get("x-vercel-ip-country") ?? null;
      const cityRaw = request.headers.get("x-vercel-ip-city") ?? null;
      const city = cityRaw ? decodeURIComponent(cityRaw) : null;
      const latRaw = request.headers.get("x-vercel-ip-latitude");
      const lngRaw = request.headers.get("x-vercel-ip-longitude");
      const lat = latRaw ? parseFloat(latRaw) : null;
      const lng = lngRaw ? parseFloat(lngRaw) : null;

      // UPDATE en background, ne bloque pas la nav
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