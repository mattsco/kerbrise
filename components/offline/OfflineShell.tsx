import Image from "next/image";
import { WifiOff, ArrowLeft } from "lucide-react";
import houseImg from "@/public/house.jpg";

/**
 * Décor commun aux pages hors ligne (#37) : photo, bandeau, retour.
 *
 * Rendu SERVEUR — ne contient rien qui dépende de la date du jour, puisque ce
 * HTML est figé dans le cache le jour du précache.
 *
 * ⚠️ La navigation entre pages hors ligne se fait en `<a>` et jamais en
 * `<Link>` : le routeur de Next irait chercher une charge RSC sur le réseau,
 * qui échoue précisément quand cette page sert. Un `<a>` provoque une
 * navigation complète, donc interceptée par le service worker.
 *
 * La photo est servie `unoptimized` à dessein : Next la sert alors depuis
 * /_next/static/media/… au lieu de /_next/image?url=…, donc le service worker
 * la précache avec les autres assets du build, sans liste à maintenir.
 */
export default function OfflineShell({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Absent sur le hub : il n'y a nulle part où remonter. */
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-3">
        {backHref ? (
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </a>
        ) : (
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
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          <p className="text-xs text-amber-800">
            Hors ligne — voici ce que Kerbrise sait sans réseau.
          </p>
        </div>

        {backHref && (
          <div className="pt-1">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {children}

        <p className="text-xs text-slate-400 text-center pt-1">
          Tout revient à la normale dès que le réseau est là.
        </p>
      </div>
    </main>
  );
}

/** Carte de navigation vers une section hors ligne — grammaire de `/dashboard/a-propos`. */
export function OfflineNavCard({
  href,
  emoji,
  title,
  description,
  accent,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-lg">{emoji}</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
    </a>
  );
}
