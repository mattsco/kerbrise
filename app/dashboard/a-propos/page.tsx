import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import AProposClient from "./AProposClient";

export const dynamic = "force-dynamic";

export default async function AProposPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Récupère intro, links, contacts en parallèle
  const [introRes, linksRes, contactsRes] = await Promise.all([
    supabase
      .from("house_intro")
      .select("id, content, updated_at, users:updated_by(display_name)")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("house_links")
      .select("id, title, url, icon, position")
      .order("position"),
    supabase
      .from("house_contacts")
      .select("id, label, name, phone, icon, position")
      .order("position"),
  ]);

  const intro = introRes.data ?? null;
  const links = linksRes.data ?? [];
  const contacts = contactsRes.data ?? [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            🏡 À propos de la maison
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Infos, liens et contacts utiles. Tout le monde peut modifier.
          </p>
        </div>

        <AProposClient
          initialIntro={intro}
          initialLinks={links}
          initialContacts={contacts}
          currentUserId={user.id}
        />
      </div>
    </main>
  );
}