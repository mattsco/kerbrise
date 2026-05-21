import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import {
  Home,
  TrendingUp,
  Award,
  Calendar,
} from "lucide-react";

const FAMILY_COLORS: Record<string, string> = {
  Antoine: "#3b82f6",
  François: "#10b981",
  Vincent: "#f59e0b",
};

const FRENCH_MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Calcule le nombre de jours entre 2 dates ISO (inclusif)
function daysBetween(startISO: string, endISO: string): number {
  const start = parseLocalDate(startISO);
  const end = parseLocalDate(endISO);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// Compte les jours d'un booking qui tombent dans un mois donné de l'année
function daysInMonth(bookingStart: string, bookingEnd: string, year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const bStart = parseLocalDate(bookingStart);
  const bEnd = parseLocalDate(bookingEnd);

  const overlapStart = bStart > monthStart ? bStart : monthStart;
  const overlapEnd = bEnd < monthEnd ? bEnd : monthEnd;

  if (overlapStart > overlapEnd) return 0;
  return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Année actuelle
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;
  const daysInYear = year % 4 === 0 ? 366 : 365;

  // Récupère tous les bookings approved qui touchent cette année
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, families(name)")
    .eq("status", "approved")
    .gte("end_date", startOfYear)
    .lte("start_date", endOfYear)
    .order("start_date");

  type BookingRow = {
    id: string;
    start_date: string;
    end_date: string;
    family_name: string;
    days_in_year: number;
    duration: number;
  };

  // Normalise et calcule les jours dans l'année courante
  const allBookings: BookingRow[] = (bookings ?? []).map((b: any) => {
    const effectiveStart = b.start_date < startOfYear ? startOfYear : b.start_date;
    const effectiveEnd = b.end_date > endOfYear ? endOfYear : b.end_date;
    return {
      id: b.id,
      start_date: b.start_date,
      end_date: b.end_date,
      family_name: b.families?.name ?? "?",
      days_in_year: daysBetween(effectiveStart, effectiveEnd),
      duration: daysBetween(b.start_date, b.end_date),
    };
  });

  // Stats par famille
  type FamilyStats = {
    name: string;
    color: string;
    totalDays: number;
    nbStays: number;
    longestStay: number;
  };

  const familyStatsMap: Record<string, FamilyStats> = {};
  for (const name of ["Antoine", "François", "Vincent"]) {
    familyStatsMap[name] = {
      name,
      color: FAMILY_COLORS[name],
      totalDays: 0,
      nbStays: 0,
      longestStay: 0,
    };
  }

  for (const b of allBookings) {
    const stat = familyStatsMap[b.family_name];
    if (stat) {
      stat.totalDays += b.days_in_year;
      stat.nbStays += 1;
      if (b.duration > stat.longestStay) stat.longestStay = b.duration;
    }
  }

  const familyStats = Object.values(familyStatsMap);
  const totalDaysReserved = familyStats.reduce((sum, f) => sum + f.totalDays, 0);
  const occupationRate = Math.round((totalDaysReserved / daysInYear) * 100);

  // Famille la plus présente
  const topFamily = [...familyStats].sort((a, b) => b.totalDays - a.totalDays)[0];

  // Stats par mois (pour graph)
  type MonthStats = {
    month: number;
    label: string;
    families: Record<string, number>;
    total: number;
  };

  const monthsStats: MonthStats[] = [];
  for (let m = 0; m < 12; m++) {
    const families: Record<string, number> = {
      Antoine: 0,
      François: 0,
      Vincent: 0,
    };
    let total = 0;
    for (const b of allBookings) {
      const days = daysInMonth(b.start_date, b.end_date, year, m);
      if (days > 0 && families[b.family_name] !== undefined) {
        families[b.family_name] += days;
        total += days;
      }
    }
    monthsStats.push({
      month: m,
      label: FRENCH_MONTHS_SHORT[m],
      families,
      total,
    });
  }

  // Mois le plus prisé
  const topMonth = [...monthsStats].sort((a, b) => b.total - a.total)[0];

  // Période la plus longue (toutes familles confondues)
  const longestStay = [...allBookings].sort((a, b) => b.duration - a.duration)[0];

  // Plus grande valeur mensuelle pour normaliser le graph
  const maxMonth = Math.max(...monthsStats.map((m) => m.total), 1);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Stats {year}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            La maison en chiffres cette année
          </p>
        </div>

        {/* Stats clés top */}
        <div className="grid grid-cols-2 gap-3">
          <BigStatCard
            icon={<Home className="w-5 h-5" />}
            label="Taux d'occupation"
            value={`${occupationRate}%`}
            sub={`${totalDaysReserved} / ${daysInYear} jours`}
          />
          <BigStatCard
            icon={<Award className="w-5 h-5" />}
            label="Famille leader"
            value={topFamily.name}
            sub={`${topFamily.totalDays} jours`}
            color={topFamily.color}
          />
        </div>

        {/* Répartition par famille */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Répartition par famille
          </h2>

          {/* Barre de répartition empilée */}
          {totalDaysReserved > 0 ? (
            <div className="space-y-4">
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {familyStats.map((f) =>
                  f.totalDays > 0 ? (
                    <div
                      key={f.name}
                      style={{
                        width: `${(f.totalDays / totalDaysReserved) * 100}%`,
                        backgroundColor: f.color,
                      }}
                      title={`${f.name} : ${f.totalDays} jours`}
                    />
                  ) : null
                )}
              </div>

              <div className="space-y-2.5">
                {familyStats.map((f) => {
                  const pct = totalDaysReserved > 0
                    ? Math.round((f.totalDays / totalDaysReserved) * 100)
                    : 0;
                  return (
                    <div key={f.name} className="flex items-center gap-3 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="font-medium text-slate-900 min-w-[80px]">
                        {f.name}
                      </span>
                      <span className="text-slate-500 flex-1">
                        {f.totalDays} j · {f.nbStays} séjour{f.nbStays > 1 ? "s" : ""}
                      </span>
                      <span className="text-slate-900 font-medium">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Aucun séjour réservé cette année.
            </p>
          )}
        </section>

        {/* Occupation par mois */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Occupation par mois
          </h2>

          <div className="space-y-2">
            {monthsStats.map((m) => {
              const widthPct = (m.total / maxMonth) * 100;
              return (
                <div key={m.month} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 w-9 text-right">
                    {m.label}
                  </span>
                  <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden flex">
                    {familyStats.map((f) => {
                      const days = m.families[f.name];
                      if (days === 0) return null;
                      const segmentPct = (days / maxMonth) * 100;
                      return (
                        <div
                          key={f.name}
                          style={{
                            width: `${segmentPct}%`,
                            backgroundColor: f.color,
                          }}
                          title={`${f.name} : ${days} j`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-slate-700 font-medium w-8 text-right">
                    {m.total > 0 ? `${m.total}j` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bloc records */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            🏆 Records {year}
          </h2>

          <div className="space-y-3 text-sm">
            <RecordLine
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label="Mois le plus prisé"
              value={topMonth.total > 0 ? `${topMonth.label} (${topMonth.total} jours)` : "—"}
            />
            <RecordLine
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              label="Séjour le plus long"
              value={
                longestStay
                  ? `${longestStay.duration} jours · ${longestStay.family_name}`
                  : "—"
              }
            />
            <RecordLine
              icon={<Home className="w-4 h-4 text-amber-500" />}
              label="Total séjours"
              value={`${allBookings.length} séjour${allBookings.length > 1 ? "s" : ""}`}
            />
          </div>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Stats basées sur les séjours approuvés de {year}
        </p>
      </div>
    </main>
  );
}

function BigStatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className="text-2xl font-bold"
        style={{ color: color ?? "#0f172a" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RecordLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-slate-500 flex-1">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}