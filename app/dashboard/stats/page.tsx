import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { Home, TrendingUp, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

const FAMILY_COLORS: Record<string, string> = {
  Antoine: "#3b82f6",
  François: "#10b981",
  Vincent: "#f59e0b",
};

const FAMILY_NAMES = ["Antoine", "François", "Vincent"] as const;

const FRENCH_MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
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

function formatRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const sameYear = s.getFullYear() === e.getFullYear();
  const sShort = s.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const eShort = e.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (sameMonth && sameYear) return `${s.getDate()} → ${eShort}`;
  return `${sShort} → ${eShort}`;
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

type AnnualChartRow = {
  year: number;
  families: Record<string, number>;
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams?: { year?: string | string[] };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const now = new Date();
  const rawYear = Array.isArray(searchParams?.year)
    ? searchParams?.year[0]
    : searchParams?.year;

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
      duration: daysInRange(b.start_date, b.end_date, b.start_date, b.end_date),
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

  const availableYears = Array.from(
    new Set(
      allBookings.flatMap((b) => [
        parseLocalDate(b.start_date).getFullYear(),
        parseLocalDate(b.end_date).getFullYear(),
      ])
    )
  ).sort((a, b) => a - b);

  const minChartYear = availableYears.length > 0 ? availableYears[0] : year;
  const maxChartYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : year;

  const annualChart: AnnualChartRow[] = [];
  for (let y = minChartYear; y <= maxChartYear; y++) {
    const families: Record<string, number> = {
      Antoine: 0,
      François: 0,
      Vincent: 0,
    };

    const rangeStart = `${y}-01-01`;
    const rangeEnd = `${y}-12-31`;

    for (const b of allBookings) {
      const days = daysInRange(b.start_date, b.end_date, rangeStart, rangeEnd);
      if (days > 0 && families[b.family_name] !== undefined) {
        families[b.family_name] += days;
      }
    }

    annualChart.push({ year: y, families });
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
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

        <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <BigStatCard
            icon={<Home className="w-5 h-5" />}
            label="Taux d'occupation"
            value={`${occupationRate}%`}
            sub={`${totalDaysReserved} / ${daysInYear} jours`}
          />

          <section className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Jours bookés par année
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Une ligne par famille
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {FAMILY_NAMES.map((name) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: FAMILY_COLORS[name] }}
                    />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>

            <AnnualLineChart data={annualChart} />
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Répartition par famille
          </h2>

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
                  const pct =
                    totalDaysReserved > 0
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
                      <span className="text-slate-900 font-medium">{pct}%</span>
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

        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Occupation par mois
          </h2>

          <div className="space-y-2">
            {monthsStats.map((m) => {
              return (
                <div key={m.month} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 w-9 text-right">
                    {m.label}
                  </span>
                  <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden flex">
                    {familyStats.map((f) => {
                      const days = m.families[f.name];
                      if (days === 0) return null;

                      const maxMonth = Math.max(...monthsStats.map((x) => x.total), 1);
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

        <section className="bg-white rounded-2xl border border-slate-100 p-5">
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
    </main>
  );
}

function AnnualLineChart({
  data,
}: {
  data: AnnualChartRow[];
}) {
  const width = 760;
  const height = 320;
  const margin = {
    top: 20,
    right: 18,
    bottom: 38,
    left: 42,
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const maxValue = Math.max(
    ...data.flatMap((row) => FAMILY_NAMES.map((name) => row.families[name] ?? 0)),
    1
  );

  const xForIndex = (index: number) => {
    if (data.length <= 1) return margin.left + innerWidth / 2;
    return margin.left + (index * innerWidth) / (data.length - 1);
  };

  const yForValue = (value: number) => {
    return margin.top + innerHeight - (value / maxValue) * innerHeight;
  };

  const series = FAMILY_NAMES.map((name) => {
    const points = data.map((row, index) => ({
      x: xForIndex(index),
      y: yForValue(row.families[name] ?? 0),
    }));

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    return {
      name,
      color: FAMILY_COLORS[name],
      points,
      path,
    };
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[640px] h-auto"
        role="img"
        aria-label="Graphique des jours bookés par année"
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const tickValue = Math.round((maxValue * (4 - i)) / 4);
          const y = margin.top + (innerHeight * i) / 4;

          return (
            <g key={i}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={margin.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400"
                fontSize="10"
              >
                {tickValue}
              </text>
            </g>
          );
        })}

        {series.map((s) => (
          <g key={s.name}>
            <path
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {s.points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="3.2"
                fill={s.color}
                stroke="white"
                strokeWidth="1.6"
              />
            ))}
          </g>
        ))}

        {data.map((row, index) => (
          <text
            key={row.year}
            x={xForIndex(index)}
            y={height - 14}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize="10"
          >
            {row.year}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BigStatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: ReactNode;
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
      <p className="text-2xl font-bold" style={{ color: color ?? "#0f172a" }}>
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