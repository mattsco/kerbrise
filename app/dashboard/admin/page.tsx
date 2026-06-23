import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuthUser } from "@/lib/supabase/auth";
import { LAUNCH_DATE } from "@/lib/config";
import {
  MessageSquarePlus,
  CheckCircle2,
  Users,
  AlertTriangle,
  BarChart3,
  Activity,
  FlaskConical,
  Database,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  // Stats rapides
  const { count: pendingFeatureRequests } = await supabase
    .from("feature_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // Séjours post-launch (vrais séjours users) — hors annulés (souvent des tests)
  const { count: postLaunchBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false)
    .neq("status", "cancelled");

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

        {/* Cartes : sous-pages thématiques */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard/admin/health"
            className="flex flex-col bg-black border border-emerald-700 rounded-2xl p-4 hover:border-emerald-400 transition font-mono min-h-[110px]"
          >
            <div className="flex items-center gap-2 text-emerald-400">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-bold tracking-wider">HEALTH</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-1">diagnostics</p>
          </Link>

          <Link
            href="/dashboard/admin/analytics"
            className="flex flex-col bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition min-h-[110px]"
          >
            <div className="flex items-center gap-2 text-purple-700">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-bold">Analytics</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">usage, adoption</p>
          </Link>

          <Link
            href="/dashboard/admin/locations"
            className="flex flex-col bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition min-h-[110px]"
          >
            <div className="flex items-center gap-2 text-blue-700">
              <span className="text-lg leading-none">🌍</span>
              <span className="text-sm font-bold">Locations</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">dernières positions</p>
          </Link>

          <Link
            href="/dashboard/admin/lab"
            className="flex flex-col bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition min-h-[110px]"
          >
            <div className="flex items-center gap-2 text-pink-700">
              <FlaskConical className="w-5 h-5" />
              <span className="text-sm font-bold">Lab</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">simulation, toggles</p>
          </Link>

          <Link
            href="/dashboard/admin/data"
            className="flex flex-col bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition min-h-[110px]"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <Database className="w-5 h-5" />
              <span className="text-sm font-bold">Data</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">séjours admin, ops</p>
          </Link>

          <Link
            href="/dashboard/admin/feature-requests"
            className="flex flex-col bg-white rounded-2xl border border-slate-100 p-4 hover:bg-slate-50 transition min-h-[110px] relative"
          >
            <div className="flex items-center gap-2 text-amber-700">
              <MessageSquarePlus className="w-5 h-5" />
              <span className="text-sm font-bold">Product</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingFeatureRequests && pendingFeatureRequests > 0
                ? `${pendingFeatureRequests} suggestion${
                    pendingFeatureRequests > 1 ? "s" : ""
                  } à traiter`
                : "feature requests"}
            </p>
            {pendingFeatureRequests !== null &&
              pendingFeatureRequests !== undefined &&
              pendingFeatureRequests > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
              )}
          </Link>
        </div>

        {/* Footer discret : liens externes */}
        <footer className="pt-2 text-center text-xs text-slate-400">
          <span className="mr-1">🔗</span>
          <ExternalLink href="https://supabase.com/dashboard/project/keufvhftoedgxclzecyp">
            Supabase
          </ExternalLink>
          {" · "}
          <ExternalLink href="https://vercel.com/matthieusco-5693s-projects/kerbrise">
            Vercel
          </ExternalLink>
          {" · "}
          <ExternalLink href="https://resend.com/emails">Resend</ExternalLink>
          {" · "}
          <ExternalLink href="https://supabase.com/dashboard/project/keufvhftoedgxclzecyp/functions">
            Edge Functions
          </ExternalLink>
        </footer>
      </div>
    </main>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-slate-600 hover:underline transition"
    >
      {children}
    </a>
  );
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
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
