import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatRange, type UpcomingBooking } from "@/lib/dashboard-banner";

type Props = {
  bookings: UpcomingBooking[];
};

export default function UpcomingStaysList({ bookings }: Props) {
  if (bookings.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Prochains séjours
        </h3>
        <Link
          href="/dashboard/calendrier"
          className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-0.5"
        >
          Voir tout
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <ul className="space-y-2.5">
        {bookings.map((b) => (
          <li key={b.id} className="flex items-center gap-3 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: b.family_color }}
            />
            <span className="font-medium text-slate-900 min-w-[80px]">
              {b.family_name}
            </span>
            <span className="text-slate-600">
              {formatRange(b.start_date, b.end_date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}