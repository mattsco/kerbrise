"use client";

import { useEffect, useState } from "react";


import { useDailyValue } from "@/lib/hooks";
import {
  getNextCollections,
  formatDateLabel,
  formatRelativeDate,
  type Collection,
} from "@/supabase/functions/_shared/garbage-collection";

export default function NextCollections() {
  const collections = useDailyValue(getNextCollections);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
        🗑️ Prochaines collectes
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {/* Couleurs lues sur la collecte elle-même : elles décrivent les VRAIS
            bacs (bleu / marron, relevés sur place le 29/08/2026) et sont
            partagées avec l'e-mail de rappel #40. Ne pas les remettre en dur
            ici — c'est comme ça qu'elles avaient divergé de la réalité. */}
        <CollectionCard collection={collections.menageres} />

        {collections.recyclables ? (
          <CollectionCard
            collection={collections.recyclables}
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
  labelOverride,
}: {
  collection: Collection;
  labelOverride?: string;
}) {
  // Fond et bordure dérivés de la couleur du bac par transparence (hex à 8
  // chiffres) : une seule valeur à maintenir au lieu de trois.
  const color = collection.color;

  return (
    <div
      className="rounded-xl p-2.5 border"
      style={{ backgroundColor: `${color}14`, borderColor: `${color}3d` }}
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