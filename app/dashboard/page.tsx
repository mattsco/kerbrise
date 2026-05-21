import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, family_id, is_family_head, families(name, color)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // @ts-ignore
  const familyName: string = profile.families?.name ?? "?";
  // @ts-ignore
  const familyColor: string = profile.families?.color ?? "#888";
  const displayName = profile.display_name ?? user.email?.split("@")[0] ?? "ami";

  // Demandes en attente pour le chef
  let pendingCount = 0;
  if (profile.is_family_head) {
    const { data: pending } = await supabase
      .from("bookings")
      .select("id, approvals(family_id)")
      .eq("status", "pending")
      .neq("family_id", profile.family_id);

    pendingCount =
      pending?.filter(
        (b: any) =>
          !b.approvals?.some((a: any) => a.family_id === profile.family_id)
      ).length ?? 0;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Kerbrise
            </h1>
            <p className="text-sm text-slate-500 mt-1">Tableau de bord</p>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-900 underline"
            >
              Se déconnecter
            </button>
          </form>
        </div>

        {/* Bannière demandes en attente */}
        {pendingCount > 0 && (
          <Link
            href="/dashboard/demandes"
            className="block bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 hover:bg-amber-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {pendingCount} demande{pendingCount > 1 ? "s" : ""} attend
                  {pendingCount > 1 ? "ent" : ""} ta validation
                </p>
                <p className="text-sm text-amber-700">Tape pour décider →</p>
              </div>
            </div>
          </Link>
        )}

        {/* Carte de bienvenue */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Bienvenue, <strong>{displayName}</strong> 👋
          </h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
            <span>Famille</span>
            <span
              className="inline-block px-3 py-0.5 rounded-full text-white text-xs font-medium"
              style={{ backgroundColor: familyColor }}
            >
              {familyName}
            </span>
            {profile.is_family_head && (
              <span className="text-amber-700">· chef de famille</span>
            )}
          </div>

          {/* Cartes d'actions */}
          <div className="mt-6 space-y-3">
            <Link
              href="/dashboard/calendrier"
              className="block border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition"
            >
              <p className="font-semibold text-slate-900">
                📅 Voir le calendrier
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Réservations des 3 familles
              </p>
            </Link>

            <Link
              href="/dashboard/demandes"
              className="block border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition"
            >
              <p className="font-semibold text-slate-900">📂 Demandes</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Mes demandes et celles à valider
              </p>
            </Link>

            <Link
              href="/dashboard/nouvelle-demande"
              className="block border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition"
            >
              <p className="font-semibold text-slate-900">➕ Nouvelle demande</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Demander un séjour à Kerbrise
              </p>
            </Link>

            <Link
              href="/dashboard/webcam"
              className="block border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition"
            >
              <p className="font-semibold text-slate-900">🌊 Webcam live</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Voir Kerbrise en direct
              </p>
            </Link>

            <Link
              href="/dashboard/profil"
              className="block border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition"
            >
              <p className="font-semibold text-slate-900">⚙️ Mon profil</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Changer mon mot de passe
              </p>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}