import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import LocationsMap from "./LocationsMap";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  const { data: users } = await supabase
    .from("users")
    .select(
      "id, display_name, email, last_seen_at, last_country, last_city, last_lat, last_lng, families(name, color)"
    );

  const usersWithLocation = (users ?? [])
    .filter((u: any) => u.last_lat && u.last_lng)
    .map((u: any) => ({
      id: u.id,
      name: u.display_name ?? "?",
      email: u.email,
      lat: u.last_lat,
      lng: u.last_lng,
      city: u.last_city,
      country: u.last_country,
      family: u.families?.name ?? "?",
      color: u.families?.color ?? "#888",
      last_seen_at: u.last_seen_at,
    }));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div>
          <BackButton label="Retour à Admin Tools" href="/dashboard/admin" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            🌍 Dernières positions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Position approximative basée sur l'IP (Vercel Geolocation).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-3">
          <LocationsMap users={usersWithLocation} />
        </div>

        {/* Liste textuelle */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Détails ({usersWithLocation.length}/{users?.length ?? 0} utilisateurs localisés)
          </h2>
          <ul className="space-y-1.5">
            {usersWithLocation.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-2"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: u.color }}
                />
                <span className="font-medium text-slate-900">{u.name}</span>
                <span className="text-xs text-slate-500">
                  · {u.city ?? "?"}, {u.country ?? "?"}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {u.last_seen_at
                    ? new Date(u.last_seen_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "?"}
                </span>
              </li>
            ))}
          </ul>
          {usersWithLocation.length === 0 && (
            <p className="text-xs text-slate-500 italic">
              Aucune position enregistrée pour le moment. Les positions apparaîtront
              dès que les utilisateurs se connecteront.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}