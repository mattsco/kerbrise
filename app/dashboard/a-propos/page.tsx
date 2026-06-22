import BackButton from "@/components/BackButton";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAuthUser } from "@/lib/supabase/auth";
import MaisonStatus from "./MaisonStatus";
import NextCollections from "./NextCollections";
import LinksContactsSection from "./LinksContactsSection";

export const dynamic = "force-dynamic";

export default async function AProposPage() {
  await requireAuthUser();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            🏡 À propos de la maison
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Infos, liens et contacts utiles de Kerbrise.
          </p>
        </div>

        {/* 1. Règles d'occupation */}
        <Link
          href="/dashboard/a-propos/regles"
          className="block bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📜</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">
                Règles d&apos;occupation
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Priorités, périodes été, et conventions familiales
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </Link>

        {/* 2. Freebox */}
        <MaisonStatus />

        {/* 3. La nouvelle télé */}
        <Link
          href="/dashboard/a-propos/tele"
          className="block bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📺</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">
                La nouvelle télé
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Mode d&apos;emploi et pièges à connaître
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </Link>

        {/* 4. Les poubelles */}
        <NextCollections />

        {/* 5. Liens utiles & contacts (figés) */}
        <LinksContactsSection />
      </div>
    </main>
  );
}
