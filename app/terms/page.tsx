import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Kerbrise",
  description: "Conditions d'utilisation de l'intégration Oura de Kerbrise.",
};

const LAST_UPDATED = "18 juin 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Kerbrise
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">
            Conditions d&apos;utilisation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">Objet</h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Kerbrise est une application familiale privée. L&apos;intégration
            Oura permet à son propriétaire de consulter ses propres données de
            santé issues de l&apos;API officielle d&apos;Oura. En utilisant
            cette intégration, vous acceptez les présentes conditions.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Utilisation
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            L&apos;intégration est réservée à un usage personnel et
            non commercial. Vous êtes responsable de la confidentialité de vos
            identifiants Oura et de l&apos;accès à votre compte.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Données et confidentialité
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Le traitement de vos données est décrit dans notre{" "}
            <Link href="/privacy" className="text-blue-600 underline">
              politique de confidentialité
            </Link>
            . Vous pouvez révoquer l&apos;accès à vos données Oura à tout
            moment depuis votre compte Oura.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Absence de garantie
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            L&apos;intégration est fournie « en l&apos;état », sans garantie
            d&apos;exactitude, de disponibilité ou de continuité. Les données
            affichées ne constituent pas un avis médical. Kerbrise n&apos;est
            pas affiliée à Ōura Health Oy.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Modifications
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Ces conditions peuvent être mises à jour. La date de dernière
            modification figure en haut de cette page.
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Kerbrise · Saint-Malo · Rothéneuf
        </p>
      </div>
    </main>
  );
}
