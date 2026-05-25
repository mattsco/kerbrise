"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Lock, Check, ShieldAlert } from "lucide-react";
import {
  canFamilyReservePlaceholder,
  type Placeholder,
} from "@/lib/summer-placeholders";
import { getYearPriorities } from "@/lib/summer-priorities";
import { reservePlaceholder } from "@/app/dashboard/calendrier/actions";
import { SUMMER_CHOICE_FREEDOM } from "@/lib/config";

type Props = {
  placeholder: Placeholder;
  allPlaceholdersForYear: Placeholder[];
  myFamilyId: string;
  myFamilyName: string;
  myUserId: string;
  myIsFamilyHead: boolean;
  myFamilyHeadNames: string[]; // ← noms des chefs de MA famille (hors moi)
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

function formatHeadsList(names: string[]): string {
  if (names.length === 0) return "à un chef de famille";
  if (names.length === 1) return `à ${names[0]}`;
  if (names.length === 2) return `à ${names[0]} ou ${names[1]}`;
  return `à ${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`;
}

export default function SummerPlaceholderModal({
  placeholder,
  allPlaceholdersForYear,
  myFamilyName,
  myIsFamilyHead,
  myFamilyHeadNames,
  onClose,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const priorityCheck = canFamilyReservePlaceholder(
    placeholder,
    myFamilyName,
    allPlaceholdersForYear
  );

  const isPermissionBlocked =
    !SUMMER_CHOICE_FREEDOM && !myIsFamilyHead;

  const canActuallyReserve = priorityCheck.allowed && !isPermissionBlocked;

  const priorities = getYearPriorities(placeholder.year);

  async function handleReserve() {
    if (!canActuallyReserve) return;
    setSubmitting(true);
    setError("");

    const result = await reservePlaceholder(
      placeholder.year,
      placeholder.period.id
    );

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(
      result.autoAssigned
        ? "Réservation enregistrée ! La dernière période a été automatiquement attribuée à la famille restante."
        : "Réservation enregistrée !"
    );

    setTimeout(() => {
      onClose();
      router.refresh();
    }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase font-medium">
              Dates
            </p>
            <p className="text-base font-semibold text-slate-900 mt-1">
              Du {formatDate(placeholder.startDate)} au{" "}
              {formatDate(placeholder.endDate)}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 uppercase font-medium mb-2">
              Ordre des choix pour l&apos;été {placeholder.year}
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

          {!priorityCheck.allowed ? (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Ce n&apos;est pas encore votre tour
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {priorityCheck.reason}
              </p>
              {priorityCheck.myPriority && (
                <p className="text-xs text-amber-700 mt-1">
                  Votre famille est en{" "}
                  <strong>Choix {priorityCheck.myPriority}</strong> pour cet
                  été.
                </p>
              )}
            </div>
          ) : isPermissionBlocked ? (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Réservé au chef de famille
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Pour l&apos;été, seul le chef de famille peut faire le choix.
                {myFamilyHeadNames.length > 0
                  ? ` Demande ${formatHeadsList(myFamilyHeadNames)} de le faire.`
                  : ""}
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                C&apos;est à vous de choisir !
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                En tant que famille en{" "}
                <strong>Choix {priorityCheck.myPriority}</strong>, vous pouvez
                réserver cette période directement, sans validation des autres
                familles.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-3">
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3">
              ✓ {success}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {canActuallyReserve && !success && (
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
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {canActuallyReserve ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}