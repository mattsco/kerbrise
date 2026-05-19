import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-sm bg-white rounded-2xl shadow p-8 text-center">
          <h1 className="text-xl font-medium mb-2">Email non reconnu</h1>
          <p className="text-sm text-slate-600 mb-6">
            L'adresse <strong>{user.email}</strong> n'est pas autorisée à
            accéder à Kerbrise.
          </p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button
              type="submit"
              className="text-sm text-slate-500 underline"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </main>
    );
  }

  // @ts-expect-error nested type
  const familyName: string = profile.families?.name ?? "?";
  // @ts-expect-error
  const familyColor: string = profile.families?.color ?? "#888";
  const isFamilyHead =
    (profile as { is_family_head?: boolean }).is_family_head ?? false;

  // Compteur de demandes en attente
  const { data: pendingBookings } = await supabase
    .from("bookings")
    .select("id, family_id")
    .eq("status", "pending");

  const allPendingCount = pendingBookings?.length ?? 0;

  let actionableCount = 0;
  if (isFamilyHead && pendingBookings && pendingBookings.length > 0) {
    const otherFamiliesBookings = pendingBookings.filter(
      (b) => b.family_id !== profile.family_id
    );

    if (otherFamiliesBookings.length > 0) {
      const bookingIds = otherFamiliesBookings.map((b) => b.id);
      const { data: myFamilyApprovals } = await supabase
        .from("approvals")
        .select("booking_id")
        .eq("family_id", profile.family_id)
        .in("booking_id", bookingIds);

      const alreadyDecidedIds = new Set(
        myFamilyApprovals?.map((a) => a.booking_id) ?? []
      );

      actionableCount = otherFamiliesBookings.filter(
        (b) => !alreadyDecidedIds.has(b.id)
      ).length;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-light">Kerbrise</h1>
            <p className="text-sm text-slate-500">Tableau de bord</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              Se déconnecter
            </button>
          </form>
        </header>

        {isFamilyHead && actionableCount > 0 && (
          <Link
            href="/dashboard/demandes"
            className="block mb-6 rounded-2xl bg-amber-50 border border-amber-300 p-4 hover:bg-amber-100 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  {actionableCount === 1
                    ? "1 demande attend ta validation"
                    : `${actionableCount} demandes attendent ta validation`}
                </p>
                <p className="text-sm text-amber-700">Tape pour décider →</p>
              </div>
            </div>
          </Link>
        )}

        {!isFamilyHead && allPendingCount > 0 && (
          <Link
            href="/dashboard/demandes"
            className="block mb-6 rounded-2xl bg-slate-100 border border-slate-200 p-4 hover:bg-slate-200 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {allPendingCount === 1
                    ? "1 demande en cours de validation"
                    : `${allPendingCount} demandes en cours de validation`}
                </p>
                <p className="text-sm text-slate-600">Tape pour voir →</p>
              </div>
            </div>
          </Link>
        )}

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-lg">
            Bienvenue,{" "}
            <strong>{profile.display_name ?? user.email}</strong> 👋
          </p>
          <p className="mt-2 text-sm text-slate-600 flex items-center gap-2 flex-wrap">
            Famille
            <span
              className="inline-block px-3 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: familyColor }}
            >
              {familyName}
            </span>
            {isFamilyHead && (
              <span className="text-xs text-amber-600">· chef de famille</span>
            )}
          </p>

          <div className="mt-8 grid gap-3">
            <Link
              href="/dashboard/calendrier"
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition"
            >
              <div className="font-medium">📅 Voir le calendrier</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Réservations des 3 familles
              </div>
            </Link>

            <Link
              href="/dashboard/demandes"
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition"
            >
              <div className="font-medium">🗂️ Demandes</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Mes demandes et celles à valider
              </div>
            </Link>

            <Link
              href="/dashboard/nouvelle-demande"
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition"
            >
              <div className="font-medium">➕ Nouvelle demande</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Demander un séjour à Kerbrise
              </div>
            </Link>

            <Link
              href="/dashboard/profil"
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition"
            >
              <div className="font-medium">⚙️ Mon profil</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Changer mon mot de passe
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}