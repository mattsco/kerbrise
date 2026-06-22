import BackButton from "@/components/BackButton";
import Image from "next/image";

export const metadata = {
  title: "La nouvelle télé — Kerbrise",
};

/**
 * Guide d'utilisation de la télé Philips du salon : prise en main + pièges
 * connus. Page de contenu statique (pas de données), au même format que
 * a-propos/regles. Lisible par tous (dont les moins à l'aise avec la tech) :
 * phrases courtes, pas de jargon.
 */
export default function TelePhilipsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton href="/dashboard/a-propos" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            📺 La nouvelle télé
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comment l'utiliser, et les quelques pièges à connaître.
          </p>
        </div>

        {/* Specs utiles */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            📋 La télé en bref
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Une <strong>Philips 40PFS6050</strong> : écran de 102 cm (40 pouces),
            Full HD. La Freebox est branchée sur <strong>HDMI 1</strong>, et la
            télé doit rester connectée au <strong>Wi-Fi</strong> pour les
            applications.
          </p>
        </section>

        {/* Une seule télécommande */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            🎮 Une seule télécommande suffit
          </h2>
          <div className="flex gap-4 items-start">
            <div className="flex-1 space-y-2">
              <p className="text-sm text-slate-700 leading-relaxed">
                La télécommande de la <strong>Freebox</strong> pilote à la fois
                le boîtier Freebox <strong>et</strong> la télé Philips :
                allumage, extinction, volume. Pas besoin de jongler avec deux
                télécommandes.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                ⚠️ Les boutons du <strong>son</strong> et du{" "}
                <strong>changement de chaîne</strong> sont spéciaux (en relief,
                en 3D) : il ne faut <strong>pas appuyer dessus</strong>, mais les{" "}
                <strong>pousser vers le haut ou vers le bas</strong>.
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                🔢 <strong>Aller directement à une chaîne</strong> : les chiffres
                sont cachés. La touche <strong>123</strong>, placée{" "}
                <strong>entre les deux boutons 3D</strong>, les fait apparaître —
                tapez ensuite le numéro (par ex. <strong>28</strong>) puis{" "}
                <strong>OK</strong>.
              </p>
            </div>
            <div className="flex-shrink-0 w-24 sm:w-28 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 p-3">
              <Image
                src="/tele/telecommande.png"
                alt="Télécommande Freebox : boutons son et chaîne en relief, touche 123 entre les deux pour afficher les chiffres"
                width={396}
                height={1274}
                sizes="112px"
                className="w-full h-auto drop-shadow-md"
              />
            </div>
          </div>
          <figure className="mt-3">
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
        </section>

        {/* Quelle application */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            📱 Pour regarder la TV : « Freebox TV »
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Dans la liste des applications, deux icônes se ressemblent. Utilisez
            la <strong>2ᵉ</strong>, <strong>Freebox TV</strong>.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            ⚠️ N'utilisez <strong>pas</strong> l'application{" "}
            <strong>Free TV</strong> : elle provoque un bug que nous avons
            constaté sur cette télé. En cas de doute, revenez sur{" "}
            <strong>Freebox TV</strong>.
          </p>
          <figure className="mt-2">
            <Image
              src="/tele/menu4Kmini.jpg"
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
            <strong>dernière chaîne</strong> et la <strong>source</strong>{" "}
            utilisées avant l'extinction. Pas de manipulation à refaire : vous
            retrouvez l'écran tel que vous l'aviez laissé.
          </p>
        </section>

        {/* Revenir sur Freebox */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            🏠 Revenir sur la Freebox
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Si vous vous retrouvez sur l'écran d'accueil <strong>Philips</strong>
            , revenez à la Freebox en choisissant l'icône{" "}
            <strong>TV</strong> ou l'icône <strong>Freebox</strong> : ce sont les
            deux entrées de la prise <strong>HDMI 1</strong> (renommée), elles{" "}
            <strong>mènent au même endroit</strong>, le boîtier Freebox.
          </p>
          <figure className="mt-2">
            <Image
              src="/tele/MenuPhilips.jpg"
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
      </div>
    </main>
  );
}
