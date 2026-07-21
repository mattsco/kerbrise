import { requireAuthUser } from "@/lib/supabase/auth";
import { WifiOff } from "lucide-react";

/**
 * Surface hors ligne (spec #37).
 *
 * ÉTAPE 1 : squelette. Un bandeau, rien d'autre. Le contenu (marées,
 * poubelles, règles, snapshot calendrier, infos pratiques) arrive aux étapes
 * 2 à 4 — l'étape 1 ne sert qu'à valider le cycle de vie du service worker
 * sur un contenu trivial, avant que quoi que ce soit en dépende.
 *
 * Protégée par l'auth comme le reste de l'app (décision 6) : le SW ne
 * l'installe qu'une fois l'utilisateur connecté, donc le fetch de précache
 * porte les cookies de session.
 *
 * ⚠️ Cette page doit rester rendue côté SERVEUR et lisible sans JavaScript.
 * Hors ligne, les chunks JS de Next ne sont pas en cache : le HTML mis en
 * cache s'affiche, mais rien ne s'hydrate. Tout contenu ajouté ici doit être
 * visible dans le HTML initial, pas produit par un effet client.
 */

// L'auth rend déjà la page dynamique ; on l'explicite pour que personne ne la
// rende statique par inadvertance en touchant au contenu.
export const dynamic = "force-dynamic";

export default async function HorsLignePage() {
  await requireAuthUser();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Hors ligne
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Pas de réseau pour le moment. Kerbrise affichera bientôt ici les
              marées, les poubelles et les règles de la maison, même sans
              connexion.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Cette page se met à jour toute seule dès que le réseau revient.
        </p>
      </div>
    </main>
  );
}
