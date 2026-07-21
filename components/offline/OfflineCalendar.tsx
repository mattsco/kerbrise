"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Eye } from "lucide-react";
import CalendarMobileView from "@/components/calendar/CalendarMobileView";
import { dateToISO } from "@/components/calendar/calendar-utils";
import type { CalendarEvent } from "@/components/calendar/CalendarDayCell";
import type { BookingMinimal } from "@/lib/summer-placeholders";
import {
  SNAPSHOT_KEY,
  formatSavedAt,
  parseSnapshot,
  snapshotFreshness,
  type OfflineSnapshot,
  type SnapshotFreshness,
} from "@/lib/offline-snapshot";

/**
 * Calendrier hors ligne — LECTURE SEULE (spec #37, décisions 3 et 8).
 *
 * Réutilise `CalendarMobileView`, la vraie vue de l'app, avec des callbacks
 * neutres : même grille, mêmes couleurs, même navigation de mois. Recopier une
 * grille « ressemblante » aurait garanti une divergence visuelle à la première
 * évolution du calendrier.
 *
 * Aucune action n'est possible : toucher un jour ne fait rien. Les flux
 * transactionnels (demande, vote, approbation) sont network-only par décision.
 */
export default function OfflineCalendar() {
  const snapshot = useSnapshot();

  // `today` doit être calculé au montage, pas au rendu serveur : ce HTML est
  // figé dans le cache le jour du précache.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  if (snapshot === undefined) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-sm text-slate-400">Lecture du calendrier…</p>
      </div>
    );
  }

  const freshness = snapshotFreshness(snapshot, new Date());

  if (!snapshot || freshness.state === "absent") {
    return <NoSnapshot />;
  }

  return (
    <div className="space-y-3">
      <FreshnessBanner freshness={freshness} />
      <ReadOnlyNotice />
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <ReadOnlyCalendar bookings={snapshot.bookings} today={today} />
      </div>
    </div>
  );
}

/**
 * `undefined` = pas encore lu (rendu serveur / avant montage).
 * `null` = lu, mais rien d'exploitable.
 */
function useSnapshot(): OfflineSnapshot | null | undefined {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null | undefined>(
    undefined
  );

  useEffect(() => {
    try {
      setSnapshot(parseSnapshot(localStorage.getItem(SNAPSHOT_KEY)));
    } catch {
      // Safari en navigation privée peut jeter sur localStorage.
      setSnapshot(null);
    }
  }, []);

  return snapshot;
}

function ReadOnlyCalendar({
  bookings,
  today,
}: {
  bookings: CalendarEvent[];
  today: Date;
}) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const b of bookings) {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = dateToISO(d);
        const list = map.get(key);
        if (list) list.push(b);
        else map.set(key, [b]);
      }
    }
    return map;
  }, [bookings]);

  const bookingsMinimal = useMemo<BookingMinimal[]>(
    () =>
      bookings.map((b) => ({
        start_date: b.start_date,
        end_date: b.end_date,
        family_id: b.family_id,
        family_name: b.family_name,
        family_color: b.color,
        status: b.status,
      })),
    [bookings]
  );

  const noop = () => {};

  return (
    <CalendarMobileView
      today={today}
      eventsByDate={eventsByDate}
      bookingsMinimal={bookingsMinimal}
      rangeStart={null}
      isInSelection={() => false}
      onDayClick={noop}
      onDayHover={noop}
      onCancelSelection={noop}
    />
  );
}

function FreshnessBanner({ freshness }: { freshness: SnapshotFreshness }) {
  if (freshness.state === "absent") return null;

  const when = formatSavedAt(freshness.savedAt);

  // Le vrai risque produit de tout #37 : un calendrier périmé montre libre ce
  // qui vient d'être pris. Au-delà du seuil, on le dit franchement.
  if (freshness.state === "stale") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Calendrier vieux de {freshness.ageDays} jours
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Dernière synchro : {when}. Des séjours ont pu être posés depuis —
            ne considère pas une période comme libre sans avoir rouvert l&apos;app
            en ligne.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
      <p className="text-xs text-slate-600">
        Dernière synchro : <span className="font-medium">{when}</span>
      </p>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <div className="flex items-center gap-2 px-1">
      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <p className="text-xs text-slate-500">
        Lecture seule — demandes et votes reviendront avec le réseau.
      </p>
    </div>
  );
}

function NoSnapshot() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center space-y-1.5">
      <p className="text-sm font-semibold text-slate-900">
        Pas encore de synchro
      </p>
      <p className="text-xs text-slate-500">
        Le calendrier se copie sur ton téléphone à chaque ouverture de Kerbrise
        avec du réseau. Rouvre l&apos;app une fois connecté et il sera
        disponible hors ligne.
      </p>
    </div>
  );
}
