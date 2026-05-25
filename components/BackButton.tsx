"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Props = {
  /** URL de destination si l'historique est vide (deep link, refresh) */
  href?: string;
  /** Label personnalisé (par défaut : "Retour") */
  label?: string;
};

export default function BackButton({
  href = "/dashboard",
  label = "Retour",
}: Props) {
  const router = useRouter();

  function handleBack() {
    // Si on a un historique → retour navigateur (instantané, page cached)
    // Sinon fallback sur la route fixe (cas du deep link / refresh)
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 -ml-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}