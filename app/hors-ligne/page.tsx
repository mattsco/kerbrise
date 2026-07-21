import Image from "next/image";
import { requireAuthUser } from "@/lib/supabase/auth";
import { WifiOff } from "lucide-react";
import OfflineContent from "@/components/offline/OfflineContent";
import houseImg from "@/public/house.jpg";

/**
 * Surface hors ligne (spec #37).
 *
 * ÉTAPE 2 : les cartes calculables en pur (marées, poubelles, rotation été).
 * Le snapshot calendrier arrive à l'étape 3, le contenu statique à l'étape 4.
 *
 * Protégée par l'auth comme le reste de l'app (décision 6) : le SW ne
 * l'installe qu'une fois l'utilisateur connecté, donc le fetch de précache
 * porte les cookies de session.
 *
 * ⚠️ Tout ce qui dépend de la DATE DU JOUR doit être calculé côté client
 * (cf. OfflineContent) : le HTML de cette page est figé dans le cache le jour
 * du précache. Seul le décor — photo, titres, bandeau — peut être rendu ici.
 *
 * La photo est servie `unoptimized` à dessein : Next la sert alors depuis
 * /_next/static/media/… au lieu de /_next/image?url=…, donc le service worker
 * la précache avec les autres assets du build, sans liste à maintenir.
 */

// L'auth rend déjà la page dynamique ; on l'explicite pour que personne ne la
// rende statique par inadvertance en touchant au contenu.
export const dynamic = "force-dynamic";

export default async function HorsLignePage() {
  await requireAuthUser();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-3">
        <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden">
          <Image
            src={houseImg}
            alt="Kerbrise"
            fill
            unoptimized
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
          <h1 className="absolute bottom-3 left-4 text-white text-xl font-semibold">
            Kerbrise
          </h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Hors ligne</h2>
            <p className="text-xs text-amber-800 mt-0.5">
              Voici ce que Kerbrise sait sans réseau. Le calendrier et les
              demandes reviendront avec la connexion.
            </p>
          </div>
        </div>

        <OfflineContent />

        <p className="text-xs text-slate-400 text-center pt-1">
          Cette page se met à jour toute seule dès que le réseau revient.
        </p>
      </div>
    </main>
  );
}
