import Image from "next/image";
import type { ReactNode } from "react";
import telecommandeImg from "@/public/tele/telecommande.png";
import menu4KminiImg from "@/public/tele/menu4Kmini.jpg";
import menuPhilipsImg from "@/public/tele/MenuPhilips.jpg";

// Copies allégées réservées au hors ligne (cf. en-tête). Les originales
// restent la source de vérité en ligne, où Next les optimise à la volée.
import telecommandeOffline from "@/public/tele/offline/telecommande.jpg";
import menu4KminiOffline from "@/public/tele/offline/menu4Kmini.jpg";
import menuPhilipsOffline from "@/public/tele/offline/MenuPhilips.jpg";

/**
 * Contenu du guide de la télé Philips — partagé par la page en ligne
 * (`/dashboard/a-propos/tele`) et sa version hors ligne (#37).
 *
 * Extrait de la page pour éviter d'en maintenir deux copies : c'est du
 * contenu qu'on relit rarement mais qu'on corrige au fil des découvertes, et
 * une divergence entre les deux versions passerait inaperçue longtemps.
 *
 * `offline` change deux choses, et rien d'autre :
 *   - les images passent en `unoptimized` sur des **copies allégées**
 *     (`public/tele/offline/`). Deux raisons cumulées : `unoptimized` sert
 *     depuis /_next/static/media/…, seule forme que le service worker sait
 *     précacher ; mais servir les originales sous cette forme coûtait 471 Ko,
 *     soit plus que tout le reste de l'offline réuni. Les copies font 136 Ko
 *     pour un rendu identique à la taille où on les regarde (≤ 760 px sur un
 *     téléphone). En ligne, rien ne change : Next optimise les originales ;
 *   - la vidéo de démonstration (4,1 Mo) est remplacée par une note. La
 *     précacher multiplierait par cinq le poids de tout l'offline pour une
 *     séquence de quelques secondes.
 */

/** Encadré d'alerte ambre : pour les pièges à ne pas rater. */
function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3">
      <span className="text-base leading-none flex-shrink-0 mt-0.5">⚠️</span>
      <p className="text-sm text-amber-900 leading-relaxed">{children}</p>
    </div>
  );
}

/** Astuce / sous-étape : encadré neutre pour isoler une manip précise. */
function Tip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-3">
      <span className="text-base leading-none flex-shrink-0 mt-0.5">{icon}</span>
      <p className="text-sm text-slate-700 leading-relaxed">{children}</p>
    </div>
  );
}

/** Hors ligne : on annonce l'absence plutôt que d'afficher un lecteur mort. */
function VideoIndisponible() {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs text-slate-500 leading-relaxed">
        🎬 La vidéo de démonstration de la touche 123 n&apos;est pas disponible
        hors ligne — elle est trop lourde pour être gardée sur le téléphone.
        Les explications ci-dessus suffisent.
      </p>
    </div>
  );
}

export default function TeleGuide({ offline = false }: { offline?: boolean }) {
  return (
    <>
      {/* L'essentiel en 3 points */}
      <section className="bg-sky-50 rounded-2xl border border-sky-100 p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          ⭐ L'essentiel en 3 points
        </h2>
        <ol className="space-y-2.5">
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-xs font-semibold flex items-center justify-center">
              1
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Une seule télécommande, celle de la télé{" "}
              <strong>Philips</strong>, pilote tout (Freebox comprise).
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-xs font-semibold flex items-center justify-center">
              2
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Boutons son et chaîne : on les <strong>pousse</strong> vers le
              haut ou le bas, on n'appuie pas dessus.
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-600 text-white text-xs font-semibold flex items-center justify-center">
              3
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Pour la TV, ouvrez l'application <strong>Freebox TV</strong> (pas
              « Free TV »).
            </p>
          </li>
        </ol>
      </section>

      {/* Specs utiles */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          📋 La télé en bref
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Une <strong>Philips 40PFS6050</strong> : écran de 102 cm (40 pouces),
          Full HD. La Freebox est branchée sur <strong>HDMI 1</strong>, et la
          télé doit rester connectée au Wi-Fi pour les applications.
        </p>
      </section>

      {/* Une seule télécommande */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          🎮 Une seule télécommande suffit
        </h2>
        <div className="flex gap-4 items-start">
          <div className="flex-1 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">
              La télécommande de la télé <strong>Philips</strong> pilote à la
              fois la télé et le boîtier Freebox : allumage, extinction,
              volume. Pas besoin de jongler avec deux télécommandes.
            </p>
            <Warning>
              Les boutons du <strong>son</strong> et du{" "}
              <strong>changement de chaîne</strong> sont spéciaux (en relief,
              en 3D) : il ne faut <strong>pas appuyer dessus</strong>, mais les{" "}
              <strong>pousser vers le haut ou vers le bas</strong>.
            </Warning>
            <Tip icon="🔢">
              <strong>Aller directement à une chaîne</strong> : les chiffres
              sont cachés. La touche <strong>123</strong>, placée entre les
              deux boutons 3D, les fait apparaître — tapez ensuite le numéro
              (par ex. 28) puis <strong>OK</strong>.
            </Tip>
          </div>
          <div className="flex-shrink-0 w-24 sm:w-28">
            <Image
              src={offline ? telecommandeOffline : telecommandeImg}
              unoptimized={offline}
              alt="Télécommande Philips : boutons son et chaîne en relief, touche 123 entre les deux pour afficher les chiffres"
              width={396}
              height={1274}
              sizes="112px"
              className="w-full h-auto"
            />
          </div>
        </div>
{offline ? <VideoIndisponible /> : (
        <figure>
          <video
            controls
            playsInline
            preload="none"
            poster="/tele/demo-telecommande-poster.jpg"
            className="w-full max-w-[260px] mx-auto h-auto rounded-2xl border border-slate-200"
          >
            <source src="/tele/demo-telecommande.mp4" type="video/mp4" />
            Votre navigateur ne peut pas lire cette vidéo.
          </video>
          <figcaption className="text-xs text-slate-400 mt-1.5 text-center">
            La touche 123 fait apparaître les chiffres, puis on tape la chaîne.
          </figcaption>
        </figure>
        )}
      </section>

      {/* Quelle application */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          📱 Pour regarder la TV : « Freebox TV »
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Dans la liste des applications, deux icônes se ressemblent. Utilisez
          la <strong>2ᵉ</strong>, <strong>Freebox TV</strong>.
        </p>
        <Warning>
          N'utilisez <strong>pas</strong> l'application « Free TV » : elle
          provoque un bug que nous avons constaté sur cette télé. En cas de
          doute, revenez sur <strong>Freebox TV</strong>.
        </Warning>
        <figure>
          <Image
            src={offline ? menu4KminiOffline : menu4KminiImg}
            unoptimized={offline}
            alt="Liste des applications de la télé : utiliser Freebox TV, pas Free TV"
            width={1230}
            height={780}
            sizes="(max-width: 640px) 100vw, 640px"
            className="w-full h-auto rounded-xl border border-slate-200"
          />
          <figcaption className="text-xs text-slate-400 mt-1.5">
            Le menu des applications — choisir « Freebox TV ».
          </figcaption>
        </figure>
      </section>

      {/* Extinction */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
        <h2 className="text-base font-semibold text-slate-900">
          ⏻ Quand on éteint la télé
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Au rallumage, la télé revient automatiquement sur la{" "}
          <strong>dernière chaîne</strong> et la source utilisées avant
          l'extinction. Pas de manipulation à refaire : vous retrouvez l'écran
          tel que vous l'aviez laissé.
        </p>
      </section>

      {/* Revenir sur Freebox */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          🏠 Revenir sur la Freebox
        </h2>
        <p className="text-sm text-slate-700 leading-relaxed">
          Si vous vous retrouvez sur l'écran d'accueil Philips, revenez à la
          Freebox en choisissant l'icône <strong>TV</strong> ou l'icône{" "}
          <strong>Freebox</strong> : ce sont les deux entrées de la prise
          HDMI 1 (renommée), elles mènent au même endroit, le boîtier Freebox.
        </p>
        <figure>
          <Image
            src={offline ? menuPhilipsOffline : menuPhilipsImg}
            unoptimized={offline}
            alt="Écran d'accueil Philips : icônes TV et Freebox menant toutes deux à la Freebox"
            width={1230}
            height={728}
            sizes="(max-width: 640px) 100vw, 640px"
            className="w-full h-auto rounded-xl border border-slate-200"
          />
          <figcaption className="text-xs text-slate-400 mt-1.5">
            L'écran d'accueil Philips — « TV » et « Freebox » vont au même
            endroit.
          </figcaption>
        </figure>
      </section>

      <p className="text-xs text-slate-400 text-center pt-2 pb-6">
        Une question ou un nouveau bug repéré ? Signale-le pour qu'on complète
        cette page.
      </p>
    </>
  );
}
