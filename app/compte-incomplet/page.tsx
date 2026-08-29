import { getAuthUser } from "@/lib/supabase/auth";
import { getCurrentProfile } from "@/lib/data/profile";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Écran de sortie pour un compte authentifié SANS ligne `public.users`.
 *
 * Ce cas n'est pas théorique : quatre comptes sont dans cet état, et l'un
 * d'eux s'est connecté pour de vrai. Avant cette page, il retombait sur
 * /login sans explication — une boucle indistinguable d'un mauvais mot de
 * passe (cf. `requireProfile`).
 *
 * La page ne dit PAS « erreur » : du point de vue de la personne, rien n'est
 * cassé, il manque juste un rattachement que seul l'admin peut faire. Elle
 * affiche l'adresse utilisée, parce que c'est exactement l'information dont
 * l'admin aura besoin — et parce que dans une famille, on se trompe de
 * compte Google plus souvent qu'on ne perd un accès.
 */
export default async function CompteIncompletPage() {
  const user = await getAuthUser();

  // Pas de session du tout → la page n'a rien à raconter.
  if (!user) redirect("/login");

  // Profil réapparu (l'admin a fait le rattachement entre-temps) : on ne
  // laisse personne coincé sur un cul-de-sac qui n'a plus lieu d'être.
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-5xl mb-4">🔑</div>
        <h1 className="text-xl font-medium mb-2">
          Ton compte n&apos;est rattaché à aucune famille
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          La connexion a bien fonctionné, mais ce compte n&apos;est encore
          relié ni à la famille Antoine, ni à Vincent, ni à François — donc
          l&apos;app n&apos;a rien à te montrer.
        </p>

        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 mb-4 break-all">
          Connecté avec <span className="font-medium">{user.email}</span>
        </p>

        <p className="text-sm text-slate-600 mb-6">
          Préviens Matthieu avec cette adresse, le rattachement prend une
          minute. Si tu as plusieurs adresses, c&apos;est peut-être l&apos;autre
          qu&apos;il faut utiliser.
        </p>

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50 transition"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
