"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Lock, Check } from "lucide-react";
import {
  canFamilyReservePlaceholder,
  type Placeholder,
} from "@/lib/summer-placeholders";
import { getYearPriorities } from "@/lib/summer-priorities";

type Props = {
  placeholder: Placeholder;
  allPlaceholdersForYear: Placeholder[];
  myFamilyId: string;
  myFamilyName: string;
  myUserId: string;
  onClose: () => void;
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

export default function SummerPlaceholderModal({
  placeholder,
  allPlaceholdersForYear,
  myFamilyId,
  myFamilyName,
  myUserId,
  onClose,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const check = canFamilyReservePlaceholder(
    placeholder,
    myFamilyName,
    allPlaceholdersForYear
  );

  const priorities = getYearPriorities(placeholder.year);

  async function handleReserve() {
    if (!check.allowed) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("bookings").insert({
      start_date: placeholder.startDate,
      end_date: placeholder.endDate,
      family_id: myFamilyId,
      created_by: myUserId,
      status: "approved",
      note: `Réservation prioritaire été ${placeholder.year} - ${placeholder.period.label}`,
      is_admin_created: false,
    });

    if (insertError) {
      setError("Erreur : " + insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">
              Été {placeholder.year}
            </p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {placeholder.period.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-4">
          {/* Dates */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase font-medium">
              Dates
            </p>
            <p className="text-base font-semibold text-slate-900 mt-1">
              Du {formatDate(placeholder.startDate)} au{" "}
              {formatDate(placeholder.endDate)}
            </p>
          </div>

          {/* Priorités de l'année */}
          <div>
            <p className="text-xs text-slate-500 uppercase font-medium mb-2">
              Ordre des choix pour l'été {placeholder.year}
            </p>
            <div className="space-y-1.5">
              {[1, 2, 3].map((p) => {
                const famName = priorities[p as 1 | 2 | 3];
                const isMyFamily = famName === myFamilyName;
                return (
                  <div
                    key={p}
                    className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg ${
                      isMyFamily
                        ? "bg-blue-50 text-blue-900 font-semibold"
                        : "text-slate-700"
                    }`}
                  >
                    <span className="text-xs text-slate-500 w-14">
                      Choix {p}
                    </span>
                    <span>{famName}</span>
                    {isMyFamily && (
                      <span className="ml-auto text-xs text-blue-700">
                        (votre famille)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Résultat */}
          {check.allowed ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                C'est à vous de choisir !
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                En tant que famille en <strong>Choix {check.myPriority}</strong>
                , vous pouvez réserver cette période directement, sans
                validation des autres familles.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Ce n'est pas encore votre tour
              </p>
              <p className="text-xs text-amber-700 mt-1">{check.reason}</p>
              {check.myPriority && (
                <p className="text-xs text-amber-700 mt-1">
                  Votre famille est en <strong>Choix {check.myPriority}</strong>{" "}
                  pour cet été.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {check.allowed && (
              <button
                onClick={handleReserve}
                disabled={submitting}
                className="flex-1 rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? "Réservation..." : "Faire son choix"}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
            >
              {check.allowed ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}