import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import AdminFeedbackBanner from "@/components/AdminFeedbackBanner";
import {
  toggleFamilyHead,
  toggleCalendarAdmin,
  simulateApprovals,
} from "../actions";
import { Crown, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; message?: string }>;

export default async function LabPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = params.status;
  const message = params.message;

  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, is_family_head, is_calendar_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton href="/dashboard/admin" label="Retour à Admin Tools" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            🧪 Lab
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Outils de simulation pour tester les flux (chef de famille, mode
            admin calendrier, approbations).
          </p>
        </div>

        {status && message && (
          <AdminFeedbackBanner
            status={status}
            message={decodeURIComponent(message)}
            backHref="/dashboard/admin/lab"
          />
        )}

        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <p className="text-xs text-slate-500">
            ⚠️ Ces actions écrivent vraiment en base et déclenchent des emails
            (en mode test → ton email).
          </p>

          <form action={toggleFamilyHead}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-3 text-sm font-medium hover:bg-blue-100 transition"
            >
              <Crown className="w-5 h-5 text-blue-600" />
              <span className="flex-1 text-left">
                {profile.is_family_head
                  ? "Repasser en simple membre"
                  : "Devenir chef de famille"}
              </span>
              <span className="text-xs text-blue-700">
                {profile.is_family_head ? "actuel : chef" : "actuel : membre"}
              </span>
            </button>
          </form>

          <form action={toggleCalendarAdmin}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-3 text-sm font-medium hover:bg-purple-100 transition"
            >
              <span className="text-lg">🛡️</span>
              <span className="flex-1 text-left">
                {profile.is_calendar_admin
                  ? "Désactiver mode Admin Calendrier"
                  : "Activer mode Admin Calendrier"}
              </span>
              <span className="text-xs text-purple-700">
                {profile.is_calendar_admin
                  ? "actuel : ACTIF"
                  : "actuel : inactif"}
              </span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await simulateApprovals("François");
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-sm font-medium hover:bg-emerald-100 transition"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="flex-1 text-left">
                Simuler approbation de François (toutes les pending)
              </span>
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await simulateApprovals("Vincent");
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm font-medium hover:bg-amber-100 transition"
            >
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
              <span className="flex-1 text-left">
                Simuler approbation de Vincent (toutes les pending)
              </span>
            </button>
          </form>
        </section>

        {/* Section : mode email (vit ici en attendant la migration #28) */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            📧 Mode email
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            En mode test, tous les emails partent uniquement vers ton adresse.
          </p>
          <p className="text-xs text-slate-700">
            Pour changer : <strong>Supabase → Edge Functions → Secrets</strong>{" "}
            → <code className="bg-slate-100 px-1 rounded">EMAIL_TEST_MODE</code>{" "}
            (true / false)
          </p>
        </section>
      </div>
    </main>
  );
}
