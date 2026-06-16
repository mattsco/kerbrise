"use client";

import { useState } from "react";
import { useDailyValue } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSyncedState } from "@/lib/hooks";
import { Pencil, Check, Trash2 } from "lucide-react";
import {
  getNextCollection,
  formatDateLabel,
} from "@/lib/garbage-collection";


export type Intro = {
  id: string;
  content: string;
  updated_at: string;
  users?:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
} | null;

type Props = {
  initialIntro: Intro;
  currentUserId: string;
  showCollections: boolean;
};

export default function IntroSection({
  initialIntro,
  currentUserId,
  showCollections,
}: Props) {
  const router = useRouter();
  const [intro] = useSyncedState<Intro>(initialIntro);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialIntro?.content ?? "");
  const [saving, setSaving] = useState(false);

  // Prochaine collecte (affichage compact si pas la grosse section)


// ...
const nextCollection = useDailyValue(getNextCollection);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    if (intro) {
      await supabase
        .from("house_intro")
        .update({
          content,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intro.id);
    } else {
      await supabase.from("house_intro").insert({
        content,
        updated_by: currentUserId,
      });
    }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const updater = Array.isArray(intro?.users) ? intro?.users[0] : intro?.users;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          📖 Bienvenue à Kerbrise
        </h2>
        {!editing && (
          <button
            onClick={() => {
              setContent(intro?.content ?? "");
              setEditing(true);
            }}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Écris ici ce que tu veux partager sur la maison..."
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              {saving ? "..." : "Enregistrer"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setContent(intro?.content ?? "");
              }}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          {intro?.content ? (
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {intro.content}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Aucun contenu encore. Clique &quot;Modifier&quot; pour ajouter une présentation.
            </p>
          )}

          {updater?.display_name && (
            <p className="text-[10px] text-slate-400 mt-3">
              Mis à jour par {updater.display_name} ·{" "}
              {new Date(intro!.updated_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}

          {/* Quick actions : prochaine collecte */}
          {!showCollections && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <Trash2
                  className="w-3.5 h-3.5"
                  style={{
                    color:
                      nextCollection.type === "recyclables"
                        ? "#C9A800"
                        : "#1F5C26",
                  }}
                />
                <span>
                  Prochaine collecte :{" "}
                  <strong className="text-slate-700 capitalize">
                    {formatDateLabel(nextCollection.date)}
                  </strong>{" "}
                  <span
                    className="ml-1 text-[10px] font-medium"
                    style={{
                      color:
                        nextCollection.type === "recyclables"
                          ? "#A38800"
                          : "#1F5C26",
                    }}
                  >
                    ({nextCollection.type === "recyclables"
                      ? "Recyclables"
                      : "Ordures"})
                  </span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}