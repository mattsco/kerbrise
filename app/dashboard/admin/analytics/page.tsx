import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { LAUNCH_DATE } from "@/lib/config";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import {
  Activity,
  Users,
  TrendingUp,
  Calendar,
  KeyRound,
  Crown,
  CheckCircle2,
  Smartphone,
  Monitor,
} from "lucide-react";

export const dynamic = "force-dynamic";


export default async function AdminAnalyticsPage() {
  const user = await requireAuthUser();
  const supabase = await createClient(); 
  

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  // Service role pour accéder à auth.users
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );

  const { data: authData } = await adminClient.auth.admin.listUsers();
  const allAuthUsers = authData?.users ?? [];


const { data: dbUsers } = await supabase
    .from("users")
    .select(
      "id, email, display_name, password_changed, last_seen_at, last_device, last_is_pwa, families(name, color)"
    );


type UserRow = {
    id: string;
    email: string;
    display_name: string | null;
    family_name: string;
    family_color: string;
    last_sign_in_at: string | null;
    last_seen_at: string | null;
    password_changed: boolean;
    last_device: string | null;
    last_is_pwa: boolean | null;
  };


const users: UserRow[] = (dbUsers ?? []).map((u: any) => {
    const authMatch = allAuthUsers.find((a: any) => a.id === u.id);
    return {
      id: u.id,
      email: u.email,
      display_name: u.display_name,
      family_name: u.families?.name ?? "?",
      family_color: u.families?.color ?? "#888",
      last_sign_in_at: authMatch?.last_sign_in_at ?? null,
      last_seen_at: u.last_seen_at ?? null,
      password_changed: u.password_changed ?? false,
      last_device: u.last_device ?? null,
      last_is_pwa: u.last_is_pwa ?? null,
    };
  });

  // Activité
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const activeToday = users.filter(
    (u) => u.last_seen_at && new Date(u.last_seen_at).getTime() > oneDayAgo
  );
  const activeWeek = users.filter(
    (u) => u.last_seen_at && new Date(u.last_seen_at).getTime() > oneWeekAgo
  );
  const activeMonth = users.filter(
    (u) => u.last_seen_at && new Date(u.last_seen_at).getTime() > oneMonthAgo
  );

  // Adoption
  const neverConnected = users.filter((u) => !u.last_sign_in_at);
  const stillDefaultPassword = users.filter(
    (u) => !u.last_sign_in_at || !u.password_changed
  );
  const ghostUsers = users.filter(
    (u) =>
      u.last_sign_in_at &&
      (!u.last_seen_at || new Date(u.last_seen_at).getTime() < oneMonthAgo)
  );

  // Connectés peu actifs (entre 7-30j)
  const seenButNotActive = users.filter((u) => {
    if (!u.last_seen_at) return false;
    const lastSeenMs = new Date(u.last_seen_at).getTime();
    return lastSeenMs > oneMonthAgo && lastSeenMs <= oneWeekAgo;
  });

  // Engagement : top créateurs (depuis le lancement, hors imports admin)
  const { data: bookingsByUser } = await supabase
    .from("bookings")
    .select("created_by, users:created_by(display_name)")
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false);

  const bookingCounts: Record<string, { name: string; count: number }> = {};
  for (const b of bookingsByUser ?? []) {
    const id = (b as any).created_by;
    const name = (b as any).users?.display_name ?? "?";
    if (!bookingCounts[id]) bookingCounts[id] = { name, count: 0 };
    bookingCounts[id].count += 1;
  }
  const topCreators = Object.values(bookingCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Engagement : top approbateurs (uniquement sur bookings non-historiques)
  const { data: postLaunchBookings } = await supabase
    .from("bookings")
    .select("id")
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false);

  const postLaunchBookingIds = (postLaunchBookings ?? []).map((b: any) => b.id);

  let topApprovers: Array<{ name: string; count: number }> = [];
  if (postLaunchBookingIds.length > 0) {
    const { data: approvalsByUser } = await supabase
      .from("approvals")
      .select("decided_by, users:decided_by(display_name)")
      .in("booking_id", postLaunchBookingIds);

    const approvalCounts: Record<string, { name: string; count: number }> = {};
    for (const a of approvalsByUser ?? []) {
      const id = (a as any).decided_by;
      const name = (a as any).users?.display_name ?? "?";
      if (!approvalCounts[id]) approvalCounts[id] = { name, count: 0 };
      approvalCounts[id].count += 1;
    }
    topApprovers = Object.values(approvalCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  // Tendance : bookings créés ces 6 derniers mois (hors imports admin)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data: recentBookings } = await supabase
    .from("bookings")
    .select("created_at")
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false)
    .gte("created_at", sixMonthsAgo.toISOString());

  const bookingsByMonth: Record<string, number> = {};
  for (let m = 0; m < 6; m++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + m);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bookingsByMonth[key] = 0;
  }
  for (const b of recentBookings ?? []) {
    const d = new Date((b as any).created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (bookingsByMonth[key] !== undefined) bookingsByMonth[key] += 1;
  }
  const monthlyData = Object.entries(bookingsByMonth).map(([k, v]) => ({
    key: k,
    label: formatMonthLabel(k),
    count: v,
  }));
  const maxMonthly = Math.max(...monthlyData.map((m) => m.count), 1);

  // Devices des users connectés
  const { data: deviceData } = await supabase
    .from("users")
    .select("last_device, last_os, last_browser")
    .not("last_device", "is", null);

  const deviceCounts: Record<string, number> = {};
  for (const d of deviceData ?? []) {
    const key = (d as any).last_device ?? "unknown";
    deviceCounts[key] = (deviceCounts[key] ?? 0) + 1;
  }

  const osCounts: Record<string, number> = {};
  for (const d of deviceData ?? []) {
    const key = (d as any).last_os ?? "Unknown";
    osCounts[key] = (osCounts[key] ?? 0) + 1;
  }

  // Temps webcam par user
  const { data: webcamData } = await supabase
    .from("webcam_sessions")
    .select("user_id, duration_seconds, users:user_id(display_name)");

  const webcamByUser: Record<
    string,
    { name: string; total: number; sessions: number }
  > = {};
  for (const w of webcamData ?? []) {
    const id = (w as any).user_id;
    const name = (w as any).users?.display_name ?? "?";
    if (!webcamByUser[id]) webcamByUser[id] = { name, total: 0, sessions: 0 };
    webcamByUser[id].total += (w as any).duration_seconds;
    webcamByUser[id].sessions += 1;
  }
  const topWebcamWatchers = Object.values(webcamByUser)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Compteur d'imports historiques (pour info)
  const { count: historicalCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("is_admin_created", true);
return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton label="Retour à Admin Tools" href="/dashboard/admin" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            📊 App Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Activité, adoption et engagement depuis le lancement (
            {new Date(LAUNCH_DATE).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            ).
          </p>
        </div>

        {/* SECTION 1 : ACTIVITÉ */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Activité récente
          </h2>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <ActiveCard
              label="Aujourd'hui"
              value={activeToday.length}
              total={users.length}
              color="emerald"
            />
            <ActiveCard
              label="7 jours"
              value={activeWeek.length}
              total={users.length}
              color="blue"
            />
            <ActiveCard
              label="30 jours"
              value={activeMonth.length}
              total={users.length}
              color="slate"
            />
          </div>
        </section>


{/* SECTION 2 : ADOPTION */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Adoption des comptes
          </h2>


{/* Légende des icônes */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-100">
                <Smartphone className="w-2.5 h-2.5 text-emerald-700" />
              </span>
              PWA mobile
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-100">
                <Monitor className="w-2.5 h-2.5 text-emerald-700" />
              </span>
              PWA desktop
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-slate-200">
                <Smartphone className="w-2.5 h-2.5 text-slate-500" />
              </span>
              Browser mobile
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-slate-200">
                <Monitor className="w-2.5 h-2.5 text-slate-500" />
              </span>
              Browser desktop
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-100">
                <KeyRound className="w-2.5 h-2.5 text-amber-700" />
              </span>
              kerbrise2026
            </span>
          </div>


          {/* 2 stats : qui utilise vs qui n'utilise pas */}

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <p className="text-xs font-medium text-emerald-700">
                Utilisent l'app
              </p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">
                {activeWeek.length}
                <span className="text-sm font-normal text-emerald-600">
                  {" "}
                  / {users.length}
                </span>
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                actifs ces 7 derniers jours
              </p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700">
                N'utilisent pas
              </p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                {neverConnected.length + ghostUsers.length}
                <span className="text-sm font-normal text-red-600">
                  {" "}
                  / {users.length}
                </span>
              </p>
              <p className="text-[10px] text-red-600 mt-0.5">
                jamais connectés ou inactifs 30j+
              </p>
            </div>
          </div>

          {/* Bandeau kerbrise2026 */}
          {stillDefaultPassword.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-amber-900">
                  {stillDefaultPassword.length} compte
                  {stillDefaultPassword.length > 1 ? "s" : ""} utilise
                  {stillDefaultPassword.length > 1 ? "nt" : ""} encore{" "}
                  <code className="bg-amber-100 px-1 rounded">
                    kerbrise2026
                  </code>
                </p>
              </div>
            </div>
          )}
{/* Utilisateurs actifs */}
          {activeWeek.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-emerald-700 mb-2 flex items-center gap-1.5">
                🟢 Utilisateurs actifs ({activeWeek.length})
              </h3>
              <ul className="space-y-1.5">
                {activeWeek
                  .sort(
                    (a, b) =>
                      new Date(b.last_seen_at!).getTime() -
                      new Date(a.last_seen_at!).getTime()
                  )
                  .map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-2 text-sm bg-emerald-50 rounded-lg p-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: u.family_color }}
                      />
                      <span className="font-medium text-slate-900">
                        {u.display_name ?? "?"}
                      </span>
                      <UsageIcon user={u} />
                      {!u.password_changed && (
                        <span
                          title="Le mot de passe n'a pas été modifié depuis kerbrise2026"
                          className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-100 flex-shrink-0"
                        >
                          <KeyRound className="w-3 h-3 text-amber-700" />
                        </span>
                      )}
                      <span className="text-xs text-slate-500 truncate">
                        {u.email}
                      </span>
                      <span className="ml-auto text-xs text-emerald-600">
                        {formatRelative(new Date(u.last_seen_at!))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Connectés mais peu actifs (7-30j) */}
          {seenButNotActive.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                🟡 Peu actifs ({seenButNotActive.length})
              </h3>
              <ul className="space-y-1.5">
                {seenButNotActive.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 text-sm bg-amber-50 rounded-lg p-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: u.family_color }}
                    />

<span className="font-medium text-slate-900">
                      {u.display_name ?? "?"}
                    </span>
                    <UsageIcon user={u} />
                    <span className="text-xs text-slate-500 truncate">
                      {u.email}
                    </span>
                    <span className="ml-auto text-xs text-amber-600">

              
                      {formatRelative(new Date(u.last_seen_at!))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Jamais connectés */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
              ⚪ Jamais connecté
              {neverConnected.length > 1 ? "s" : ""} ({neverConnected.length})
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
                    <UsageIcon user={u} />
                    <span className="ml-auto text-slate-400">
                  
                      {u.family_name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ghost users (connectés mais pas vus depuis 30j) */}
          {ghostUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">
                👻 Inactifs depuis 30+ jours ({ghostUsers.length})
              </h3>
              <ul className="space-y-1.5">
                {ghostUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg p-2"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: u.family_color }}
                    />
                    <span className="font-medium text-slate-900">
                      {u.display_name ?? "?"}
                    </span>
                    <span className="ml-auto text-slate-400">
                      {u.last_seen_at
                        ? `Vu ${formatRelative(new Date(u.last_seen_at))}`
                        : "Jamais vu"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* SECTION 3 : ENGAGEMENT */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            Engagement
          </h2>

          <div className="mb-5">
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-500" />
              Top créateurs de séjours
            </h3>
            {topCreators.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Aucun séjour créé depuis le lancement.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topCreators.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm bg-blue-50 rounded-lg p-2"
                  >
                    <span className="w-6 text-xs text-slate-400 text-center">
                      #{i + 1}
                    </span>
                    <span className="font-medium text-slate-900 flex-1">
                      {c.name}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {c.count} séjour{c.count > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              Top approbateurs (chefs)
            </h3>
            {topApprovers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Aucune décision encore depuis le lancement.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topApprovers.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm bg-amber-50 rounded-lg p-2"
                  >
                    <span className="w-6 text-xs text-slate-400 text-center">
                      #{i + 1}
                    </span>
                    <span className="font-medium text-slate-900 flex-1">
                      {a.name}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {a.count} décision{a.count > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* SECTION 4 : TENDANCE */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
            Nouvelles demandes (6 derniers mois)
          </h2>

          <div className="space-y-2">
            {monthlyData.map((m) => {
              const widthPct = (m.count / maxMonthly) * 100;
              return (
                <div
                  key={m.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-xs text-slate-500 w-12 text-right">
                    {m.label}
                  </span>
                  <div className="flex-1 h-6 bg-slate-50 rounded-md overflow-hidden relative">
                    {m.count > 0 && (
                      <div
                        className="h-full bg-purple-400 rounded-md transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    )}
                    {m.count > 0 && (
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-purple-900">
                        {m.count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
    {/* SECTION 5 : DEVICES + WEBCAM */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
            📱 Devices & Webcam
          </h2>

          {/* Devices */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              Type d'appareil
            </h3>
            <div className="space-y-1.5">
              {Object.entries(deviceCounts).map(([device, count]) => {
                const total = Object.values(deviceCounts).reduce(
                  (s, c) => s + c,
                  0
                );
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const emoji =
                  device === "mobile" ? "📱" : device === "tablet" ? "📊" : "💻";
                return (
                  <div
                    key={device}
                    className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-2"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="font-medium text-slate-900 capitalize">
                      {device}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
              {Object.keys(deviceCounts).length === 0 && (
                <p className="text-xs text-slate-500 italic">
                  Aucune donnée encore.
                </p>
              )}
            </div>
          </div>

          {/* OS */}
          {Object.keys(osCounts).length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-medium text-slate-700 mb-2">
                Systèmes
              </h3>
              <div className="space-y-1.5">
                {Object.entries(osCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([os, count]) => (
                    <div
                      key={os}
                      className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-2"
                    >
                      <span className="font-medium text-slate-900">{os}</span>
                      <span className="ml-auto text-xs text-slate-500">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Webcam */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              📹 Top du temps passé sur la webcam
            </h3>
            {topWebcamWatchers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Personne n'a encore regardé la webcam.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {topWebcamWatchers.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm bg-purple-50 rounded-lg p-2"
                  >
                    <span className="w-6 text-xs text-slate-400 text-center">
                      #{i + 1}
                    </span>
                    <span className="font-medium text-slate-900 flex-1">
                      {w.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {w.sessions} session{w.sessions > 1 ? "s" : ""}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {formatDuration(w.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Données depuis le lancement ({LAUNCH_DATE}) · ✨ {historicalCount ?? 0} séjour
          {(historicalCount ?? 0) > 1 ? "s" : ""} historique
          {(historicalCount ?? 0) > 1 ? "s" : ""} importé
          {(historicalCount ?? 0) > 1 ? "s" : ""} (non comptés)
        </p>
      </div>
    </main>
  );
}

function ActiveCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "emerald" | "blue" | "slate";
}) {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-100",
    blue: "bg-blue-50 text-blue-900 border-blue-100",
    slate: "bg-slate-50 text-slate-900 border-slate-100",
  };
  return (
    <div className={`rounded-xl border p-3 ${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {value}
        <span className="text-sm font-normal opacity-50"> / {total}</span>
      </p>
    </div>
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
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatMonthLabel(key: string): string {
  const [, m] = key.split("-");
  const months = [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Juin",
    "Juil",
    "Août",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ];
  return months[parseInt(m) - 1];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m${secs > 0 ? ` ${secs}s` : ""}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
}


function UsageIcon({
  user,
}: {
  user: { last_device: string | null; last_is_pwa: boolean | null };
}) {
  if (user.last_is_pwa === null || user.last_device === null) return null;

  const isMobile =
    user.last_device === "mobile" || user.last_device === "tablet";
  const isPwa = user.last_is_pwa;

  const bgColor = isPwa ? "bg-emerald-100" : "bg-slate-200";
  const textColor = isPwa ? "text-emerald-700" : "text-slate-500";
  const Icon = isMobile ? Smartphone : Monitor;
  const label = `${isPwa ? "PWA" : "Navigateur"} ${isMobile ? "mobile" : "desktop"}`;

  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${bgColor} flex-shrink-0`}
    >
      <Icon className={`w-3 h-3 ${textColor}`} />
    </span>
  );
}


