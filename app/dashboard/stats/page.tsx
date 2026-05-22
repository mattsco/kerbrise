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

  const now = new Date();

  const rawYear = Array.isArray(params?.year) ? params.year[0] : params?.year;
  const parsedYear = Number(rawYear);

  const year = Number.isFinite(parsedYear) ? parsedYear : now.getFullYear();

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const daysInYear = Math.round(
    (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) / MS_PER_DAY
  );

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, families(name)")
    .eq("status", "approved")
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

  const yearBookings = allBookings.filter((b) => b.days_in_year > 0);

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

  for (const b of yearBookings) {
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

    for (const b of yearBookings) {
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
  const longestStay = [...yearBookings].sort((a, b) => b.duration - a.duration)[0];

  const maxMonth = Math.max(...monthsStats.map((m) => m.total), 1);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Stats {year}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              La maison en chiffres cette année
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/stats?year=${year - 1}`}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
              aria-label="Année précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>

            <span className="min-w-20 h-10 px-4 rounded-full border border-slate-200 bg-white text-slate-800 text-sm font-medium flex items-center justify-center">
              {year}
            </span>

            <Link
              href={`/dashboard/stats?year=${year + 1}`}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
              aria-label="Année suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BigStatCard
            icon={<Home className="w-5 h-5" />}
            label="Taux d'occupation"
            value={`${occupationRate}%`}
            sub={`${totalDaysReserved} / ${daysInYear} jours`}
          />
          <BigStatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Séjours cette année"
            value={`${yearBookings.length}`}
sub={`Séjour${yearBookings.length > 1 ? "s" : ""} approuvés`}
          />
        </div>

        <section
          key={`months-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[fadeUp_420ms_ease-out_both]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Occupation par mois
          </h2>

          <div className="space-y-2">
            {monthsStats.map((m, index) => (
              <div
                key={m.month}
                className="flex items-center gap-3 text-xs animate-[rowIn_420ms_ease-out_both]"
                style={{ animationDelay: `${index * 28}ms` }}
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
                        className="animate-[growX_520ms_ease-out_both] origin-left"
                        style={{
                          width: `${segmentPct}%`,
                          backgroundColor: f.color,
                          animationDelay: `${index * 28}ms`,
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
            ))}
          </div>
        </section>

        <section
          key={`family-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[fadeUp_520ms_ease-out_both]"
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
                      className="animate-[growX_600ms_ease-out_both] origin-left"
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
                      className="flex items-center gap-3 text-sm animate-[rowIn_420ms_ease-out_both]"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
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

        <section
          key={`records-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[fadeUp_580ms_ease-out_both]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Records {year}
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
              value={`${yearBookings.length} séjour${yearBookings.length > 1 ? "s" : ""}`}
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
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes rowIn {
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
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