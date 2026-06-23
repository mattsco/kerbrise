import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import AdminBookingForm from "@/components/AdminBookingForm";
import { Database } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, is_calendar_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  const { data: families } = await supabase
    .from("families")
    .select("id, name, color")
    .order("name");

  const { data: allUsers } = await supabase
    .from("users")
    .select("id, display_name, family_id")
    .order("display_name");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton href="/dashboard/admin" label="Retour à Admin Tools" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            <Database className="w-6 h-6 text-slate-700" />
            Data
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Opérations data : création de séjours en mode admin (sans email).
            Imports, resets et exports viendront ici.
          </p>
        </div>

        {profile.is_calendar_admin ? (
          <section className="bg-white rounded-2xl border border-purple-200 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                🛡️ Ajouter un séjour (mode admin)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Crée une réservation au nom de n&apos;importe quelle famille,
                sans déclencher d&apos;email.
              </p>
            </div>
            <AdminBookingForm families={families ?? []} users={allUsers ?? []} />
          </section>
        ) : (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm text-amber-900">
              Le mode Admin Calendrier doit être activé pour ajouter un séjour.
              Active-le depuis le{" "}
              <a href="/dashboard/admin/lab" className="underline font-medium">
                Lab
              </a>
              .
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
