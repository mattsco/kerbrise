import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import {
  Home,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";

const FAMILY_COLORS: Record<string, string> = {
  Antoine: "#3b82f6",
  François: "#10b981",
  Vincent: "#f59e0b",
};

const FAMILY_NAMES = ["Antoine", "François", "Vincent"] as const;

const FRENCH_MONTHS_SHORT = [
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

const MIN_YEAR = 2015;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

function daysBetween(startISO: string, endISO: string): number {
  const start = parseLocalDate(startISO);
  const end = parseLocalDate(endISO);
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function daysInRange(
  startISO: string,
  endISO: string,
  rangeStartISO: string,
  rangeEndISO: string
): number {
  const start = parseLocalDate(startISO);
  const end = parseLocalDate(endISO);
  const rangeStart = parseLocalDate(rangeStartISO);
  const rangeEnd = parseLocalDate(rangeEndISO);

  const overlapStart = start > rangeStart ? start : rangeStart;
  const overlapEnd = end < rangeEnd ? end : rangeEnd;

  if (overlapStart > overlapEnd) return 0;

  return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / MS_PER_DAY) + 1;
}

type BookingRow = {
  id: string;
  start_date: string;
  end_date: string;
  family_name: string;
  days_in_year: number;
  duration: number;
};

type FamilyStats = {
  name: string;
  color: string;
  totalDays: number;
  nbStays: number;
  longestStay: number;
};

type MonthStats = {
  month: number;
  label: string;
  families: Record<string, number>;
  total: number;
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const currentYear = new Date().getFullYear();

  const rawYear = Array.isArray(params?.year) ? params.year[0] : params?.year;
  const parsedYear = Number(rawYear);

  let year = Number.isFinite(parsedYear) ? parsedYear : currentYear;
  if (year < MIN_YEAR) year = MIN_YEAR;
  if (year > currentYear) year = currentYear;

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const daysInYear = daysBetween(startOfYear, endOfYear);

  const springStart = `${year}-04-01`;
  const springEnd = `${year}-09-30`;
  const springDays = daysBetween(springStart, springEnd);

  // On ne récupère que les bookings qui touchent l'année affichée
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, families(name)")
    .eq("status", "approved")
    .lte("start_date", endOfYear)
    .gte("end_date", startOfYear)
    .order("start_date");

  const allBookings: BookingRow[] = (bookings ?? []).map((b: any) => {
    const effectiveStart = b.start_date < startOfYear ? startOfYear : b.start_date;
    const effectiveEnd = b.end_date > endOfYear ? endOfYear : b.end_date;

    return {
      id: b.id,
      start_date: b.start_date,
      end_date: b.end_date,
      family_name: b.families?.name ?? "?",
      days_in_year: daysInRange(effectiveStart, effectiveEnd, startOfYear, endOfYear),
      duration: daysBetween(b.start_date, b.end_date),
    };
  });

  const familyStatsMap: Record<string, FamilyStats> = {};
  for (const name of FAMILY_NAMES) {
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

  const familyStats = Object.values(familyStatsMap).sort(
    (a, b) => b.totalDays - a.totalDays || a.name.localeCompare(b.name)
  );

  const totalDaysReserved = familyStats.reduce((sum, f) => sum + f.totalDays, 0);
  const occupationRate = Math.round((totalDaysReserved / daysInYear) * 100);

  const springDaysReserved = allBookings.reduce((sum, b) => {
    return sum + daysInRange(b.start_date, b.end_date, springStart, springEnd);
  }, 0);
  const springRate = Math.round((springDaysReserved / springDays) * 100);

  const monthsStats: MonthStats[] = [];
  for (let m = 0; m < 12; m++) {
    const families: Record<string, number> = {
      Antoine: 0,
      François: 0,
      Vincent: 0,
    };

    let total = 0;
    const monthStart = dateToISO(new Date(year, m, 1));
    const monthEnd = dateToISO(new Date(year, m + 1, 0));

    for (const b of allBookings) {
      const days = daysInRange(b.start_date, b.end_date, monthStart, monthEnd);
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

  const topMonth = [...monthsStats].sort((a, b) => b.total - a.total)[0];
  const longestStay = [...allBookings].sort((a, b) => b.duration - a.duration)[0];
  const maxMonth = Math.max(...monthsStats.map((m) => m.total), 1);

  const canGoPrev = year > MIN_YEAR;
  const canGoNext = year < currentYear;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton />

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Stats {year}
          </h1>

          <div className="flex items-center gap-2">
            {canGoPrev ? (
              <Link
                href={`/dashboard/stats?year=${year - 1}`}
                className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
                aria-label="Année précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
            ) : (
              <div className="w-10 h-10 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300">
                <ChevronLeft className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-[84px] h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-sm font-medium text-slate-800">
              {year}
            </div>

            {canGoNext ? (
              <Link
                href={`/dashboard/stats?year=${year + 1}`}
                className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
                aria-label="Année suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="w-10 h-10 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300">
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <BigStatCard
            className="md:col-span-1"
            icon={<Home className="w-5 h-5" />}
            label="Taux d'occupation"
            value={`${occupationRate}%`}
            sub={`${totalDaysReserved} / ${daysInYear} jours`}
          />

          <BigStatCard
            className="md:col-span-2"
            icon={<TrendingUp className="w-5 h-5" />}
            label="Taux d'occupation printemps-été"
            value={`${springRate}%`}
            sub={`${springDaysReserved} / ${springDays} jours · avril à septembre`}
          />
        </div>

        {/* Répartition par famille */}
        <section
          key={`family-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[fadeUp_320ms_ease-out]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Répartition par famille
          </h2>

          {totalDaysReserved > 0 ? (
            <div className="space-y-4">
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                {familyStats.map((f, index) =>
                  f.totalDays > 0 ? (
                    <div
                      key={f.name}
                      className="origin-left animate-[growX_650ms_cubic-bezier(.2,.8,.2,1)_both]"
                      style={{
                        width: `${(f.totalDays / totalDaysReserved) * 100}%`,
                        backgroundColor: f.color,
                        animationDelay: `${index * 70}ms`,
                      }}
                      title={`${f.name} : ${f.totalDays} jours`}
                    />
                  ) : null
                )}
              </div>

              <div className="space-y-2.5">
                {familyStats.map((f, index) => {
                  const pct =
                    totalDaysReserved > 0
                      ? Math.round((f.totalDays / totalDaysReserved) * 100)
                      : 0;

                  return (
                    <div
                      key={f.name}
                      className="flex items-center gap-3 text-sm animate-[fadeUp_420ms_ease-out_both]"
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="font-medium text-slate-900 min-w-[80px]">
                        {f.name}
                      </span>
                      <span className="text-slate-500 flex-1">
                        {f.totalDays} j
                      </span>
                      <span className="font-semibold text-slate-900">
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
        <section
          key={`months-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[fadeUp_360ms_ease-out]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Occupation par mois
          </h2>

          <div className="space-y-2.5">
            {monthsStats.map((m, index) => (
              <div
                key={m.month}
                className="flex items-center gap-3 text-xs animate-[fadeUp_380ms_ease-out_both]"
                style={{ animationDelay: `${index * 24}ms` }}
              >
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
                        className="origin-left animate-[growX_700ms_cubic-bezier(.2,.8,.2,1)_both]"
                        style={{
                          width: `${segmentPct}%`,
                          backgroundColor: f.color,
                        }}
                        title={`${f.name} : ${days} j`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Records */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Records {year}
          </h2>

          <div className="space-y-3 text-sm">
            <RecordLine
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label="Mois le plus prisé"
              value={
                topMonth.total > 0 ? `${topMonth.label} (${topMonth.total} jours)` : "—"
              }
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

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes growX {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
      `}</style>
    </main>
  );
}

function BigStatCard({
  icon,
  label,
  value,
  sub,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RecordLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
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