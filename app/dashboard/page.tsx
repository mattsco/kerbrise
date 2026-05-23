import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWADetector from "@/components/PWADetector";
import {
  Calendar,
  Inbox,
  Plus,
  Video,
  KeyRound,
  LogOut,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  User, 
  Home
} from "lucide-react";

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sShort = s.toLocaleDateString("fr-FR", { day: "numeric", month: sameMonth ? undefined : "short" });
  const eShort = e.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (sameMonth && sameYear) return `${s.getDate()} → ${eShort}`;
  return `${sShort} → ${eShort}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, family_id, is_family_head, is_admin, families(name, color)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // @ts-ignore
  const familyName: string = profile.families?.name ?? "?";
  // @ts-ignore
  const familyColor: string = profile.families?.color ?? "#888";
  const displayName = profile.display_name ?? user.email?.split("@")[0] ?? "ami";

  // Demandes en attente pour le chef
  let pendingCount = 0;
  if (profile.is_family_head) {
    const { data: pending } = await supabase
      .from("bookings")
      .select("id, approvals(family_id)")
      .eq("status", "pending")
      .neq("family_id", profile.family_id);

    pendingCount =
      pending?.filter(
        (b: any) =>
          !b.approvals?.some((a: any) => a.family_id === profile.family_id)
      ).length ?? 0;
  }

  // Prochains séjours approuvés
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const { data: upcoming } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, families(name, color)")
    .eq("status", "approved")
    .gte("end_date", todayISO)
    .order("start_date")
    .limit(3);

  const upcomingBookings = (upcoming ?? []).map((b: any) => ({
    id: b.id,
    start_date: b.start_date,
    end_date: b.end_date,
    family_name: b.families?.name ?? "?",
    family_color: b.families?.color ?? "#888",
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 backdrop-blur-md bg-white/90">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">
            Kerbrise
          </h1>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-32 space-y-5">
        {/* Bannière demandes en attente */}
        {pendingCount > 0 && (
          <Link
            href="/dashboard/demandes"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">
                  {pendingCount} demande{pendingCount > 1 ? "s" : ""} attend
                  {pendingCount > 1 ? "ent" : ""} ta validation
                </p>
                <p className="text-xs text-amber-700">Tape pour décider</p>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-700 flex-shrink-0" />
            </div>
          </Link>
        )}

        {/* Hero avec photo de la maison */}
        <div className="relative rounded-3xl overflow-hidden shadow-sm">
          <img
            src="/house.jpg"
            alt="Kerbrise"
            className="w-full h-48 sm:h-56 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-sm font-medium text-white/90">
              Bonjour 👋
            </p>
            <h2 className="text-2xl font-bold mt-0.5">{displayName}</h2>
            <div className="flex items-center gap-2 mt-2 text-xs text-white/90">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: familyColor }}
              />
              <span>
                Famille {familyName}
                {profile.is_family_head && (
                  <span className="text-white/70"> · chef de famille</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Prochains séjours */}
        {upcomingBookings.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Prochains séjours
              </h3>
              <Link
                href="/dashboard/calendrier"
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-0.5"
              >
                Voir tout
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="space-y-2.5">
              {upcomingBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: b.family_color }}
                  />
                  <span className="font-medium text-slate-900 min-w-[80px]">
                    {b.family_name}
                  </span>
                  <span className="text-slate-600">
                    {formatRange(b.start_date, b.end_date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Cartes d'actions */}
        <div className="space-y-3">
          <ActionCard
            href="/dashboard/calendrier"
            icon={<Calendar className="w-5 h-5" />}
            iconBg="bg-blue-50 text-blue-600"
            title="Calendrier"
            desc="Vue des réservations sur 3 mois"
          />
          <ActionCard
            href="/dashboard/demandes"
            icon={<Inbox className="w-5 h-5" />}
            iconBg="bg-amber-50 text-amber-600"
            title="Demandes"
            desc="Mes demandes et celles à valider"
          />
          <ActionCard
            href="/dashboard/nouvelle-demande"
            icon={<Plus className="w-5 h-5" />}
            iconBg="bg-emerald-50 text-emerald-600"
            title="Nouvelle demande"
            desc="Demander un séjour à Kerbrise"
          />
          <ActionCard
            href="/dashboard/stats"
            icon={<TrendingUp className="w-5 h-5" />}
            iconBg="bg-purple-50 text-purple-600"
            title="Stats"
            desc="Quelques graphiques"
          />
          <ActionCard
            href="/dashboard/webcam"
            icon={<Video className="w-5 h-5" />}
            iconBg="bg-cyan-50 text-cyan-600"
            title="Webcam live"
            desc="Voir le Val en direct"
          />
      <ActionCard
            href="/dashboard/a-propos"
            icon={<Home className="w-5 h-5" />}
            iconBg="bg-orange-50 text-orange-600"
            title="À propos de la maison"
            desc="Liens, contacts et infos pratiques"
          />
          <ActionCard
            href="/dashboard/profil"
            icon={<User className="w-5 h-5" />}
            iconBg="bg-slate-100 text-slate-600"
            title="Mon profil"
            desc="Mes infos, stats et mot de passe"
          />

          {profile.is_admin && (
            <ActionCard
              href="/dashboard/admin"
              icon={<span className="text-base">🕵🏻‍♂️</span>}
              iconBg="bg-purple-50 text-purple-600"
              title="Secret Admin Tools"
              desc="Outils admin (seulement toi)"
            />
          )}
        </div>
      </div>
{/* Détection PWA installée vs navigateur (invisible) */}
      <PWADetector />

      {/* Bandeau PWA Install (sticky bottom) - invisible si déjà installé / desktop / dismiss */}
      <PWAInstallPrompt />
    </main>
     
  );
}

function ActionCard({
  href,
  icon,
  iconBg,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-[15px]">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition flex-shrink-0" />
    </Link>
  );
}