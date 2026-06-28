import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { requireAuthUser } from "@/lib/supabase/auth";
import { getApprovedBookingsOverlappingRange } from "@/lib/data/bookings";
import {
  dateToISO,
  daysInRangeInclusive,
  daysBetween,
  nightsInRangeClipped,
} from "@/lib/dates";
import { FAMILY_NAMES, FAMILY_COLORS } from "@/lib/families";
import {
  Home,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { CountUp, GrowBar } from "./StatsClient";

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

  await requireAuthUser();

  const supabase = await createClient();

  const currentYear = new Date().getFullYear();

  const rawYear = Array.isArray(params?.year)
    ? params.year[0]
    : params?.year;

  const parsedYear = Number(rawYear);

  let year = Number.isFinite(parsedYear) ? parsedYear : currentYear;

  if (year < MIN_YEAR) year = MIN_YEAR;
  if (year > currentYear) year = currentYear;

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const daysInYear = daysInRangeInclusive(startOfYear, endOfYear);

  const springStart = `${year}-04-01`;
  const springEnd = `${year}-09-30`;

  const springDays = daysInRangeInclusive(springStart, springEnd);

  const bookings = await getApprovedBookingsOverlappingRange(
    supabase,
    startOfYear,
    endOfYear
  );

  const allBookings: BookingRow[] = bookings.map((b) => {
    return {
      id: b.id,
      start_date: b.start_date,
      end_date: b.end_date,
      family_name: b.family_name,
      // Nuits du séjour tombant dans l'année (convention Kerbrise).
      days_in_year: nightsInRangeClipped(
        b.start_date,
        b.end_date,
        startOfYear,
        endOfYear
      ),
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

      if (b.duration > stat.longestStay) {
        stat.longestStay = b.duration;
      }
    }
  }

  const familyStats = Object.values(familyStatsMap).sort(
    (a, b) => b.totalDays - a.totalDays || a.name.localeCompare(b.name)
  );

  const totalDaysReserved = familyStats.reduce(
    (sum, f) => sum + f.totalDays,
    0
  );

  const occupationRate = Math.round(
    (totalDaysReserved / daysInYear) * 100
  );

  const springDaysReserved = allBookings.reduce((sum, b) => {
    return (
      sum +
      nightsInRangeClipped(b.start_date, b.end_date, springStart, springEnd)
    );
  }, 0);

  const springRate = Math.round((springDaysReserved / springDays) * 100);

  const monthsStats: MonthStats[] = [];

  for (let m = 0; m < 12; m++) {
    const families: Record<string, number> = {};
    for (const name of FAMILY_NAMES) {
      families[name] = 0;
    }

    let total = 0;

    const monthStart = dateToISO(new Date(year, m, 1));
    const monthEnd = dateToISO(new Date(year, m + 1, 0));

    for (const b of allBookings) {
      const days = nightsInRangeClipped(
        b.start_date,
        b.end_date,
        monthStart,
        monthEnd
      );

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

  const longestStay = [...allBookings].sort(
    (a, b) => b.duration - a.duration
  )[0];

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
                replace
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
                replace
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

        <div
          key={`cards-${year}`}
          className="grid grid-cols-2 gap-3 animate-[yearFade_350ms_ease-out]"
        >
          <BigStatCard
            icon={<Home className="w-4 h-4" />}
            label="Taux d'occupation"
            value={occupationRate}
            suffix="%"
            sub={`${totalDaysReserved} / ${daysInYear} j`}
          />

          <BigStatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Printemps-été"
            value={springRate}
            suffix="%"
            sub={`${springDaysReserved} / ${springDays} j`}
          />
        </div>

        <section
          key={`families-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[yearFade_350ms_ease-out]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Répartition par famille
          </h2>

          {totalDaysReserved > 0 ? (
            <div className="space-y-4">
              <div className="h-3 rounded-full overflow-hidden bg-slate-100">
                <GrowBar
                  segments={familyStats.map((f) => ({
                    key: f.name,
                    pct: (f.totalDays / totalDaysReserved) * 100,
                    color: f.color,
                    title: `${f.name} : ${f.totalDays} jours`,
                  }))}
                />
              </div>

              <div className="space-y-2.5">
                {familyStats.map((f) => {
                  const pct =
                    totalDaysReserved > 0
                      ? Math.round((f.totalDays / totalDaysReserved) * 100)
                      : 0;

                  return (
                    <div
                      key={f.name}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: f.color,
                        }}
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

        <section
          key={`months-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[yearFade_350ms_ease-out]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Occupation par mois
          </h2>

          <div className="space-y-2.5">
            {monthsStats.map((m) => (
              <div
                key={m.month}
                className="flex items-center gap-3 text-xs"
              >
                <span className="text-slate-500 w-9 text-right">
                  {m.label}
                </span>

                <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden">
                  <GrowBar
                    delay={m.month * 45}
                    segments={familyStats.map((f) => ({
                      key: f.name,
                      pct: (m.families[f.name] / maxMonth) * 100,
                      color: f.color,
                      title: `${f.name} : ${m.families[f.name]} j`,
                    }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          key={`records-${year}`}
          className="bg-white rounded-2xl border border-slate-100 p-5 animate-[yearFade_350ms_ease-out]"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Records {year}
          </h2>

          <div className="space-y-3 text-sm">
            <RecordLine
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label="Mois le plus prisé"
              value={
                topMonth.total > 0
                  ? `${topMonth.label} (${topMonth.total} jours)`
                  : "—"
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
              value={`${allBookings.length} séjour${
                allBookings.length > 1 ? "s" : ""
              }`}
            />
          </div>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Stats basées sur les séjours approuvés de {year}
        </p>
      </div>

      <style>{`
        @keyframes yearFade {
          from {
            opacity: 0;
            transform: scale(0.99);
          }
          to {
            opacity: 1;
            transform: scale(1);
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
  suffix,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] sm:text-xs mb-1.5 whitespace-nowrap">
        {icon}
        <span className="leading-none">{label}</span>
      </div>

      <p className="text-[26px] sm:text-3xl leading-none font-bold text-slate-900">
        <CountUp value={value} suffix={suffix} />
      </p>

      {sub && (
        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">{sub}</p>
      )}
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