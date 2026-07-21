import { WifiOff } from "lucide-react";

/**
 * Le bandeau qui explique la situation, une bonne fois, en tête du hub.
 *
 * Il occupe la place de la bannière contextuelle du dashboard en ligne — même
 * position, même poids visuel. Il dit *pourquoi* des sections manquent, pas
 * seulement qu'elles manquent : une famille non technique doit comprendre que
 * l'app n'est pas cassée, et savoir que rien n'est perdu.
 */
export default function OfflineExplainer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-amber-900 text-sm">
            Pas de réseau pour le moment
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Kerbrise affiche ce qu&apos;il a gardé sur ton téléphone : marées,
            poubelles, règles de la maison, wifi, et la dernière copie connue du
            calendrier. Les sections grisées ont besoin d&apos;Internet — elles
            reviendront toutes seules dès que la connexion sera de retour.
          </p>
        </div>
      </div>
    </div>
  );
}
