import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Vérifie que l'utilisateur est connecté
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Récupère le profil + sa famille
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, families(name, color)")
    .eq("id", user.id)
    .single();

  // Email reconnu mais pas dans family_members → profil pas créé
  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-sm bg-white rounded-2xl shadow p-8 text-center">
          <h1 className="text-xl font-medium mb-2">Email non reconnu</h1>
          <p className="text-sm text-slate-600 mb-6">
            L'adresse <strong>{user.email}</strong> n'est pas autorisée à
            accéder à Kerbrise.
          </p>
          <p className="text-xs text-slate-400">
            Contacte Matthieu si tu penses que c'est une erreur.
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

  // @ts-expect-error : Supabase typing for nested join
  const familyName: string = profile.families?.name ?? "?";
  // @ts-expect-error
  const familyColor: string = profile.families?.color ?? "#888";

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

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-lg">
            Bienvenue,{" "}
            <strong>{profile.display_name ?? user.email}</strong> 👋
          </p>
          <p className="mt-2 text-sm text-slate-600 flex items-center gap-2">
            Famille
            <span
              className="inline-block px-3 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: familyColor }}
            >
              {familyName}
            </span>
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
            <div className="block rounded-lg border border-slate-200 p-4 opacity-50">
              <div className="font-medium">➕ Nouvelle demande</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Bientôt disponible
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}