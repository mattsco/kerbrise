"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureRequestStatus } from "@/app/dashboard/about/actions";
import type { FeatureRequestRow } from "./page";
import { Clock, PlayCircle, CheckCircle, XCircle, Pencil, Check, X } from "lucide-react";

const STATUS_CONFIG = {
  pending: {
    label: "En attente",
    icon: Clock,
    classes: "bg-amber-50 text-amber-800 border-amber-200",
  },
  in_progress: {
    label: "En cours",
    icon: PlayCircle,
    classes: "bg-blue-50 text-blue-800 border-blue-200",
  },
  done: {
    label: "Faite",
    icon: CheckCircle,
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  rejected: {
    label: "Rejetée",
    icon: XCircle,
    classes: "bg-slate-50 text-slate-600 border-slate-200",
  },
} as const;

const STATUS_ORDER: FeatureRequestRow["status"][] = [
  "pending",
  "in_progress",
  "done",
  "rejected",
];

export default function FeatureRequestsAdminList({
  rows,
}: {
  rows: FeatureRequestRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Regroupe par status pour affichage
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: rows.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  async function changeStatus(
    id: string,
    newStatus: FeatureRequestRow["status"],
    currentNote: string | null
  ) {
    setSaving(true);
    await updateFeatureRequestStatus(id, newStatus, currentNote ?? undefined);
    setSaving(false);
    router.refresh();
  }

  async function saveNote(id: string, currentStatus: FeatureRequestRow["status"]) {
    setSaving(true);
    await updateFeatureRequestStatus(id, currentStatus, editNote);
    setSaving(false);
    setEditingId(null);
    setEditNote("");
    router.refresh();
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ status, items }) => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        return (
          <section key={status}>
            <h2 className="text-xs font-semibold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" />
              {config.label} ({items.length})
            </h2>
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-100 p-4"
                >
                  {/* Header : auteur + date */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>
                      {r.user_display_name ?? "user inconnu"}
                      {r.user_family_name && ` · ${r.user_family_name}`}
                    </span>
                    <span>{formatDate(r.created_at)}</span>
                  </div>

                  {/* Titre + description */}
                  <p className="font-semibold text-slate-900 text-sm mb-1">
                    {r.title}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line mb-3">
                    {r.description}
                  </p>

                  {/* Admin note (si présente ou en édition) */}
                  {editingId === r.id ? (
                    <div className="mb-3 space-y-2">
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={2}
                        placeholder="Note pour soi-même (ex: lien Jira, décision...)"
                        disabled={saving}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveNote(r.id, r.status)}
                          disabled={saving}
                          className="rounded-md bg-slate-900 text-white px-2.5 py-1 text-[11px] font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Enregistrer
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditNote("");
                          }}
                          disabled={saving}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    r.admin_note && (
                      <div className="mb-3 bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 flex items-start gap-2">
                        <Pencil className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                        <span className="whitespace-pre-line flex-1">
                          {r.admin_note}
                        </span>
                      </div>
                    )
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {STATUS_ORDER.filter((s) => s !== r.status).map((s) => {
                      const sConfig = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => changeStatus(r.id, s, r.admin_note)}
                          disabled={saving}
                          className={`text-[11px] px-2 py-1 rounded-md border transition disabled:opacity-50 ${sConfig.classes} hover:opacity-80`}
                        >
                          → {sConfig.label}
                        </button>
                      );
                    })}
                    {editingId !== r.id && (
                      <button
                        onClick={() => {
                          setEditingId(r.id);
                          setEditNote(r.admin_note ?? "");
                        }}
                        disabled={saving}
                        className="text-[11px] px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 ml-auto flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {r.admin_note ? "Modifier note" : "+ Note"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}