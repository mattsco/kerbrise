import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
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
} from "lucide-react";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

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

// Familles + users pour la modal admin
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
  const { count: totalBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true });
  const { count: pendingBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Liste des utilisateurs avec last_sign_in_at (depuis auth.users)
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );

  const { data: authUsers } = await adminClient.auth.admin.listUsers();
  const allAuthUsers = authUsers?.users ?? [];

  const { data: dbUsers } = await supabase
    .from("users")
    .select("id, email, display_name, families(name, color)");

  type UserRow = {
    id: string;
    email: string;
    display_name: string | null;
    family_name: string;
    family_color: string;
    last_sign_in_at: string | null;
  };

  const usersWithStatus: UserRow[] = (dbUsers ?? []).map((u: any) => {
    const authMatch = allAuthUsers.find((a: any) => a.id === u.id);
    return {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      family_name: u.families?.name ?? "?",
      family_color: u.families?.color ?? "#888",
      last_sign_in_at: authMatch?.last_sign_in_at ?? null,
    };
  });

  const neverConnected = usersWithStatus.filter((u) => !u.last_sign_in_at);
  const connected = usersWithStatus.filter((u) => u.last_sign_in_at);

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

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Utilisateurs" value={totalUsers ?? 0} icon={<Users className="w-4 h-4" />} />
          <StatCard label="Demandes" value={totalBookings ?? 0} icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="En attente" value={pendingBookings ?? 0} icon={<AlertTriangle className="w-4 h-4" />} />
        </div>

        {/* Section : actions de simulation */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            🧪 Outils de simulation
          </h2>
          <p className="text-xs text-slate-500">
            ⚠️ Ces actions écrivent vraiment en base et déclenchent des emails (en mode test → ton email).
          </p>

          {/* Toggle chef de famille */}
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

{/* Toggle calendar admin */}
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
                {profile.is_calendar_admin ? "actuel : ACTIF" : "actuel : inactif"}
              </span>
            </button>
          </form>

          {/* Simuler François */}
          <form action={async () => {
            "use server";
            await simulateApprovals("François");
          }}>
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

          {/* Simuler Vincent */}
          <form action={async () => {
            "use server";
            await simulateApprovals("Vincent");
          }}>
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


{/* Section : ajout admin de séjour (visible seulement en mode admin calendrier) */}
        {profile.is_calendar_admin && (
          <section className="bg-white rounded-2xl border border-purple-200 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                🛡️ Ajouter un séjour (mode admin)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Crée une réservation au nom de n'importe quelle famille, sans déclencher d'email.
              </p>
            </div>
            <AdminBookingForm
              families={families ?? []}
              users={allUsers ?? []}
            />
          </section>
        )}


        {/* Section : tracking adoption */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            👥 Adoption des comptes
          </h2>

          <div className="mb-5">
            <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
              ⚪ Jamais connecté{neverConnected.length > 1 ? "s" : ""} ({neverConnected.length})
            </h3>
            {neverConnected.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">
                Tous les comptes ont été activés 🎉
              </p>
            ) : (
              <ul className="space-y-1.5">
                {neverConnected.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 text-sm bg-red-50 rounded-lg p-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: u.family_color }}
                    />
                    <span className="font-medium text-slate-900">
                      {u.display_name ?? "?"}
                    </span>
                    <span className="text-xs text-slate-500">· {u.email}</span>
                    <span className="ml-auto text-xs text-slate-400">
                      {u.family_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-emerald-700 mb-2">
              ✅ Connectés ({connected.length})
            </h3>
            <ul className="space-y-1.5">
              {connected.map((u) => {
                const last = u.last_sign_in_at
                  ? new Date(u.last_sign_in_at)
                  : null;
                const lastLabel = last
                  ? formatRelative(last)
                  : "?";
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: u.family_color }}
                    />
                    <span className="font-medium text-slate-900">
                      {u.display_name ?? "?"}
                    </span>
                    <span className="text-xs text-slate-500 truncate">
                      {u.email}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">
                      {lastLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

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
            Pour changer : <strong>Supabase → Edge Functions → Secrets</strong> →{" "}
            <code className="bg-slate-100 px-1 rounded">EMAIL_TEST_MODE</code>{" "}
            (true / false)
          </p>
        </section>
      </div>
    </main>
  );
}

function FeedbackBanner({ status, message }: { status: string; message: string }) {
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
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

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}