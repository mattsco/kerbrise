"use client";

import { Plus } from "lucide-react";


type Props = {
  onClick: () => void;
};

/**
 * Bouton "+ Nouvelle demande" (#31, block 3).
 * Ouvre le NewBookingModal sans dates préremplies — l'utilisateur
 * peut aussi sélectionner 2 jours directement dans la grille.
 */
export default function SidepanelNewBookingButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition"
    >
      <Plus size={16} />
      Nouvelle demande
    </button>
  );
}
