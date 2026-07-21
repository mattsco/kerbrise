import { WifiOff, ArrowLeft } from "lucide-react";

/**
 * Décor commun aux pages hors ligne (#37) : header, bandeau, retour.
 *
 * Calque le chrome du dashboard en ligne (header collant, largeur `max-w-2xl`,
 * fond `slate-50`) pour qu'on ne se sente pas dans une autre app. La seule
 * différence assumée est le bandeau hors ligne, qui explique une bonne fois
 * pourquoi certaines sections manquent.
 *
 * Rendu SERVEUR — ne contient rien qui dépende de la date du jour, puisque ce
 * HTML est figé dans le cache le jour du précache.
 *
 * ⚠️ La navigation entre pages hors ligne se fait en `<a>` et jamais en
 * `<Link>` : le routeur de Next irait chercher une charge RSC sur le réseau,
 * qui échoue précisément quand cette page sert. Un `<a>` provoque une
 * navigation complète, donc interceptée par le service worker.
 */
export default function OfflineShell({
  title,
  subtitle,
  backHref,
  hero,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Absent sur le hub : il n'y a nulle part où remonter. */
  backHref?: string;
  /** Bloc pleine largeur affiché avant le contenu (hero du hub). */
  hero?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 backdrop-blur-md bg-white/90">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Kerbrise</h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            <WifiOff className="w-3 h-3" />
            Hors ligne
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-6 space-y-5">
        {backHref && (
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </a>
        )}

        {hero}

        {backHref && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {children}
      </div>
    </main>
  );
}

/**
 * Carte d'action — copie conforme de l'`ActionCard` du dashboard, y compris
 * l'état désactivé pour les sections qui n'existent pas hors ligne.
 *
 * Les sections indisponibles restent VISIBLES et à leur place, grisées et
 * expliquées (décision 5) : on ne laisse pas croire que l'app a perdu la
 * moitié de ses fonctions.
 */
export function OfflineActionCard({
  href,
  icon,
  iconBg,
  title,
  desc,
}: {
  /** Absent = section indisponible hors ligne. */
  href?: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  const inner = (
    <>
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          href ? iconBg : "bg-slate-100 text-slate-300"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-semibold text-[15px] ${
            href ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {title}
        </p>
        <p
          className={`text-xs mt-0.5 truncate ${
            href ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {desc}
        </p>
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="flex items-center gap-4 bg-white/60 rounded-2xl border border-slate-100 border-dashed p-4">
        {inner}
        <span className="text-[10px] font-medium text-slate-400 shrink-0 uppercase tracking-wide">
          Hors ligne
        </span>
      </div>
    );
  }

  return (
    <a
      href={href}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition"
    >
      {inner}
    </a>
  );
}
