"use client";

import { useState } from "react";
import { Wifi } from "lucide-react";
import { WIFI_PASSWORD } from "@/lib/config";

/**
 * Mot de passe wifi hors ligne (spec #37, décision 1).
 *
 * Reprend la grammaire de `MaisonStatus` — même carte, même bouton de copie —
 * mais sans la pastille Freebox : hors ligne, cette carte mesure le réseau et
 * n'aurait rien à dire. Ici on affiche le mot de passe en clair plutôt que de
 * le cacher derrière un bouton : quand on cherche le wifi, c'est justement
 * qu'on n'a pas de réseau, et un presse-papier ne se relit pas.
 */
export default function OfflineWifi() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(WIFI_PASSWORD);
    } catch {
      // Safari refuse le presse-papier hors d'un geste direct sur certaines
      // versions : le mot de passe reste lisible à l'écran, donc on n'insiste
      // pas. On signale quand même la copie comme faite serait mentir.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Wifi className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-900">Wifi</span>
        <span className="text-sm font-mono text-slate-600 truncate">
          {WIFI_PASSWORD}
        </span>
      </div>

      <button
        onClick={copy}
        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}
