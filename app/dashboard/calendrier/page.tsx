import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KerbriseCalendar, { BookingEvent } from "@/components/Calendar";
import Link from "next/link";

export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  families: { name: string; color: string } | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, start_date, end_date, status, note, families(name, color)")
    .in("status", ["pending", "approved"])
    .order("start_date");

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-red-600">Erreur Supabase : {error.message}</p>
      </main>
    );
  }

  const events: BookingEvent[] = (bookings as unknown as BookingRow[]).map(
    (b) => {
      const familyName = b.families?.name ?? "?";
      const familyColor = b.families?.color ?? "#888";
      const statusLabel = b.status === "pending" ? " (en attente)" : "";
      return {
        id: b.id,
        title: `${familyName}${statusLabel}${b.note ? " · " + b.note : ""}`,
        start: new Date(b.start_date + "T00:00:00"),
        end: new Date(b.end_date + "T23:59:59"),
        familyName,
        familyColor,
        status: b.status,
      };
    }
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-500 underline">
              ← Tableau de bord
            </Link>
            <h1 className="text-2xl font-light mt-1">Calendrier</h1>
          </div>
        </header>

        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <Legend color="#3b82f6" label="Antoine" />
          <Legend color="#10b981" label="François" />
          <Legend color="#f59e0b" label="Vincent" />
          <span className="ml-2 text-slate-500">
            (plein = approuvé · hachuré = en attente)
          </span>
        </div>

        <KerbriseCalendar events={events} />
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}