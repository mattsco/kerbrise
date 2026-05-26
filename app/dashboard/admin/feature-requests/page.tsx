import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import { MessageSquarePlus } from "lucide-react";
import FeatureRequestsAdminList from "./FeatureRequestsAdminList";

export const dynamic = "force-dynamic";

export type FeatureRequestRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "rejected";
  admin_note: string | null;
  created_at: string;
  user_display_name: string | null;
  user_family_name: string | null;
};

export default async function FeatureRequestsAdminPage() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  // Vérifie qu'on est admin (la RLS protège déjà, mais on redirige aussi côté UI)
  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  // Fetch toutes les feature requests avec infos de l'auteur
  const { data: requests } = await supabase
    .from("feature_requests")
    .select(
      `
      id, user_id, title, description, status, admin_note, created_at,
      users(display_name, families(name))
    `
    )
    .order("created_at", { ascending: false });

  const rows: FeatureRequestRow[] = (requests ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description,
    status: r.status,
    admin_note: r.admin_note,
    created_at: r.created_at,
    user_display_name: r.users?.display_name ?? null,
    user_family_name: r.users?.families?.name ?? null,
  }));

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const inProgressCount = rows.filter((r) => r.status === "in_progress").length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton href="/dashboard/admin" label="Retour admin" />

        <header>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquarePlus className="w-6 h-6 text-blue-500" />
            Feature requests
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {rows.length} suggestion{rows.length > 1 ? "s" : ""} reçue
            {rows.length > 1 ? "s" : ""}
            {pendingCount > 0 && (
              <>
                {" "}· <strong className="text-amber-700">{pendingCount} en attente</strong>
              </>
            )}
            {inProgressCount > 0 && (
              <>
                {" "}· <strong className="text-blue-700">{inProgressCount} en cours</strong>
              </>
            )}
          </p>
        </header>

        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-sm text-slate-500">
              Aucune suggestion pour l&apos;instant. Quand un user en envoie une depuis
              <strong> À propos de cette app</strong>, elle apparaîtra ici.
            </p>
          </div>
        ) : (
          <FeatureRequestsAdminList rows={rows} />
        )}
      </div>
    </main>
  );
}