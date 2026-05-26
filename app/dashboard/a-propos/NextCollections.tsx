"use client";

import { useEffect, useState } from "react";


import { useDailyValue } from "@/lib/hooks";
import {
  getNextCollections,
  formatDateLabel,
  formatRelativeDate,
  type Collection,
} from "@/lib/garbage-collection";

export default function NextCollections() {
  const collections = useDailyValue(getNextCollections);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
        🗑️ Prochaines collectes
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <CollectionCard
          collection={collections.menageres}
          color="#1F5C26"
          bg="#1F5C2615"
          border="#1F5C2640"
        />

        {collections.recyclables ? (
          <CollectionCard
            collection={collections.recyclables}
            color="#A38800"
            bg="#E9DB1525"
            border="#E9DB1570"
            labelOverride="Recyclables"
          />
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-center">
            <p className="text-[10px] text-slate-500 italic text-center">
              Calendrier 2027 à venir
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-500 italic pt-0.5">
        💡 Sortir les bacs la veille au soir · Saint-Malo Agglo, Secteur C
      </p>
    </div>
  );
}

function CollectionCard({
  collection,
  color,
  bg,
  border,
  labelOverride,
}: {
  collection: Collection;
  color: string;
  bg: string;
  border: string;
  labelOverride?: string;
}) {
  return (
    <div
      className="rounded-xl p-2.5 border"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-[11px] font-medium leading-none"
          style={{ color }}
        >
          {labelOverride ?? collection.label}
        </span>
      </div>
      <p className="font-bold text-slate-900 text-sm capitalize leading-tight">
        {formatDateLabel(collection.date)}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">
        {formatRelativeDate(collection.date)}
      </p>
    </div>
  );
}