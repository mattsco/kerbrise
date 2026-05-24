"use client";

import { useEffect, useState } from "react";
import {
  getNextCollections,
  formatDateLabel,
  formatRelativeDate,
} from "@/lib/garbage-collection";

export default function NextCollections() {
  const [collections, setCollections] = useState(getNextCollections());

  // Re-calcule à chaque minute (au cas où on dépasse minuit en pleine session)
  useEffect(() => {
    const interval = setInterval(() => {
      setCollections(getNextCollections());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
      <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
        🗑️ Prochaines collectes
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Ordures ménagères */}
        <div className="bg-amber-900/5 border border-amber-900/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-amber-900" />
            <span className="text-xs font-medium text-amber-900">
              Ordures ménagères
            </span>
          </div>
          <p className="font-bold text-slate-900 text-sm capitalize">
            {formatDateLabel(collections.menageres.date)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatRelativeDate(collections.menageres.date)}
          </p>
        </div>

        {/* Recyclables */}
        {collections.recyclables ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-xs font-medium text-amber-700">
                Recyclables
              </span>
            </div>
            <p className="font-bold text-slate-900 text-sm capitalize">
              {formatDateLabel(collections.recyclables.date)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatRelativeDate(collections.recyclables.date)}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-center">
            <p className="text-xs text-slate-500 italic text-center">
              Calendrier 2027 à venir
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 italic">
        💡 Sortir les bacs la veille au soir. Saint-Malo Agglo, Secteur C.
      </p>
    </div>
  );
}