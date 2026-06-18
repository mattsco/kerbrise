import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité · Kerbrise",
  description:
    "Politique de confidentialité de l'intégration Oura de Kerbrise.",
};

const LAST_UPDATED = "18 juin 2026";

export default function PrivacyPage() {
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
            Politique de confidentialité
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dernière mise à jour : {LAST_UPDATED}
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Qui sommes-nous
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Kerbrise est une application familiale privée. Cette intégration
            permet à son propriétaire d&apos;accéder à ses propres données
            Oura via l&apos;API officielle d&apos;Oura. L&apos;application
            n&apos;est pas destinée au grand public.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Données collectées
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Après votre autorisation explicite via Oura, l&apos;application peut
            accéder aux catégories de données que vous avez approuvées, parmi :
            informations personnelles (âge, taille, poids), résumés quotidiens
            (sommeil, activité, readiness), fréquence cardiaque, séances,
            entraînements, tags et SpO2.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            L&apos;accès est limité aux scopes que vous accordez au moment de
            la connexion. Vous pouvez en révoquer une partie ou la totalité à
            tout moment.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Utilisation des données
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Les données sont utilisées uniquement pour les afficher à
            l&apos;utilisateur propriétaire du compte. Elles ne sont ni
            vendues, ni louées, ni partagées avec des tiers à des fins
            publicitaires ou commerciales.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Stockage et sécurité
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Les jetons d&apos;accès et les données récupérées sont stockés de
            manière sécurisée (base de données Supabase, chiffrement en
            transit via HTTPS). L&apos;accès est restreint au propriétaire de
            l&apos;application.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            Conservation et suppression
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Vous pouvez révoquer l&apos;accès à vos données à tout moment
            depuis votre compte Oura. La révocation interrompt tout accès et
            entraîne la suppression des jetons associés.
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Kerbrise · Saint-Malo · Rothéneuf
        </p>
      </div>
    </main>
  );
}
