import { createClient } from "@/lib/supabase/server";
import {
  toggleFamilyHead,
  simulateApprovals,
  toggleCalendarAdmin,
} from "./actions";
import BackButton from "@/components/BackButton";
import { redirect } from "next/navigation";
import AdminBookingForm from "@/components/AdminBookingForm";
import Link from "next/link";
import {
  Database,
  Mail,
  ExternalLink,
  Crown,
  CheckCircle2,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  BarChart3,
  Activity,
} from "lucide-react";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

const LAUNCH_DATE = "2026-05-22";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = params.status;
  const message = params.message;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, is_family_head, is_calendar_admin")
    .eq("id", user.id)
    .single();

  const { data: families } = await supabase
    .from("families")
    .select("id, name, color")
    .order("name");

  const { data: allUsers } = await supabase
    .from("users")
    .select("id, display_name, family_id")
    .order("display_name");

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  // Stats rapides
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // Séjours post-launch (vrais séjours users)
  const { count: postLaunchBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false);

  // Séjours historiques (imports admin)
  const { count: historicalBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("is_admin_created", true);

  const { count: pendingBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            🕵🏻‍♂️ Secret Admin Tools
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tu es le seul à voir cette page.
          </p>
        </div>

        {/* Encart de feedback */}
        {status && message && (
          <FeedbackBanner status={status} message={decodeURIComponent(message)} />
        )}

        {/* 2 gros boutons : Health (gauche) + Analytics (droite) */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/admin/health"
            className="block bg-black border border-emerald-700 rounded-2xl p-4 hover:border-emerald-400 transition font-mono"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-bold tracking-wider">HEALTH</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-1">
              system diagnostics
            </p>
          </Link>

          <Link
            href="/dashboard/admin/analytics"
            className="block bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2 text-purple-700">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-bold">App Analytics</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              activité, adoption, engagement
            </p>
          </Link>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Utilisateurs"
            value={totalUsers ?? 0}
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            label="Séjours"
            value={postLaunchBookings ?? 0}
            icon={<CheckCircle2 className="w-4 h-4" />}
            sub={`+ ${historicalBookings ?? 0} old`}
          />
          <StatCard
            label="En attente"
            value={pendingBookings ?? 0}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        </div>

        {/* Section : actions de simulation */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            🧪 Outils de simulation
          </h2>
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

        {/* Section : ajout admin de séjour */}
        {profile.is_calendar_admin && (
          <section className="bg-white rounded-2xl border border-purple-200 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                🛡️ Ajouter un séjour (mode admin)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Crée une réservation au nom de n'importe quelle famille, sans
                déclencher d'email.
              </p>
            </div>
            <AdminBookingForm
              families={families ?? []}
              users={allUsers ?? []}
            />
          </section>
        )}

        {/* Section : liens externes */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            🔗 Accès rapide
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <ExternalCard
              href="https://supabase.com/dashboard/project/keufvhftoedgxclzecyp"
              icon={<Database className="w-4 h-4" />}
              label="Supabase"
            />
            <ExternalCard
              href="https://vercel.com/matthieusco-5693s-projects/kerbrise"
              icon={<ExternalLink className="w-4 h-4" />}
              label="Vercel"
            />
            <ExternalCard
              href="https://resend.com/emails"
              icon={<Mail className="w-4 h-4" />}
              label="Resend"
            />
            <ExternalCard
              href="https://supabase.com/dashboard/project/keufvhftoedgxclzecyp/functions"
              icon={<ExternalLink className="w-4 h-4" />}
              label="Edge Functions"
            />
          </div>
        </section>

        {/* Section : mode test */}
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

function FeedbackBanner({
  status,
  message,
}: {
  status: string;
  message: string;
}) {
  if (status === "success") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm font-medium">{message}</div>
        <Link
          href="/dashboard/admin"
          className="text-xs text-emerald-700 hover:underline flex-shrink-0"
        >
          OK
        </Link>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm font-medium">{message}</div>
        <Link
          href="/dashboard/admin"
          className="text-xs text-red-700 hover:underline flex-shrink-0"
        >
          OK
        </Link>
      </div>
    );
  }
  if (status === "info") {
    return (
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm font-medium">{message}</div>
        <Link
          href="/dashboard/admin"
          className="text-xs text-blue-700 hover:underline flex-shrink-0"
        >
          OK
        </Link>
      </div>
    );
  }
  return null;
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && (
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function ExternalCard({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 hover:bg-slate-100 transition"
    >
      {icon}
      <span className="flex-1">{label}</span>
      <ExternalLink className="w-3 h-3 text-slate-400" />
    </a>
  );
}