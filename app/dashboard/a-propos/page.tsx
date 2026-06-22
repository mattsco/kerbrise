import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import AProposClient from "./AProposClient";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { dateToISO } from "@/lib/dates";
import { requireAuthUser } from "@/lib/supabase/auth";


export const dynamic = "force-dynamic";

export default async function AProposPage() {

const user = await requireAuthUser();
const supabase = await createClient(); 
  

  // Récupère intro, links, contacts + family_id user
  const [introRes, linksRes, contactsRes, userProfileRes] = await Promise.all([
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
    supabase
      .from("users")
      .select("family_id")
      .eq("id", user.id)
      .single(),
  ]);

  const intro = introRes.data ?? null;
  const links = linksRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const familyId = userProfileRes.data?.family_id ?? null;

  // Détermine si la famille de l'user a un séjour approved en cours
  // ou qui commence dans les 3 prochains jours.
  let showCollections = false;
  if (familyId) {
const today = new Date();
const in3Days = new Date(today);
in3Days.setDate(in3Days.getDate() + 3);
const todayISO = dateToISO(today);
const in3DaysISO = dateToISO(in3Days);

    // Query : un membre de la famille a-t-il une résa approved qui :
    // - termine dans le futur (end_date >= today)
    // - commence dans <= 3 jours (start_date <= today + 3)
    const { count } = await supabase
      .from("bookings")
      .select("id, users!inner(family_id)", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("users.family_id", familyId)
      .gte("end_date", todayISO)
      .lte("start_date", in3DaysISO);

    showCollections = (count ?? 0) > 0;
  }

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
                Règles d'occupation
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Priorités, périodes été, et conventions familiales
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </Link>

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
                Mode d'emploi et pièges à connaître
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </Link>

        <AProposClient
          initialIntro={intro}
          initialLinks={links}
          initialContacts={contacts}
          currentUserId={user.id}
          showCollections={showCollections}
        />
      </div>
    </main>
  );
}