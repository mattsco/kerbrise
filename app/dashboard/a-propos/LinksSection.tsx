"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSyncedState } from "@/lib/hooks";
import {
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

export type Link = {
  id: string;
  title: string;
  url: string;
  icon: string;
  position: number;
};

type Props = {
  initialLinks: Link[];
  currentUserId: string;
};

type LinkForm = {
  show: boolean;
  editing: Link | null;
  title: string;
  url: string;
  icon: string;
};

const EMPTY_FORM: LinkForm = {
  show: false,
  editing: null,
  title: "",
  url: "",
  icon: "🔗",
};

export default function LinksSection({
  initialLinks,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [links] = useSyncedState<Link[]>(initialLinks);

  const [form, setForm] = useState<LinkForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openForm(link: Link | null = null) {
    setForm({
      show: true,
      editing: link,
      title: link?.title ?? "",
      url: link?.url ?? "",
      icon: link?.icon ?? "🔗",
    });
    setError("");
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setError("");
  }

  async function save() {
    setError("");
    if (!form.title.trim() || !form.url.trim()) {
      setError("Titre et URL obligatoires.");
      return;
    }
    try {
      new URL(form.url);
    } catch {
      setError("URL invalide (doit commencer par http:// ou https://).");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    if (form.editing) {
      await supabase
        .from("house_links")
        .update({
          title: form.title.trim(),
          url: form.url.trim(),
          icon: form.icon.trim() || "🔗",
        })
        .eq("id", form.editing.id);
    } else {
      await supabase.from("house_links").insert({
        title: form.title.trim(),
        url: form.url.trim(),
        icon: form.icon.trim() || "🔗",
        created_by: currentUserId,
        position: links.length,
      });
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

  async function deleteLink(id: string) {
    if (!confirm("Supprimer ce lien ?")) return;
    const supabase = createClient();
    await supabase.from("house_links").delete().eq("id", id);
    router.refresh();
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          🔗 Liens utiles
        </h2>
        {!form.show && (
          <button
            onClick={() => openForm()}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        )}
      </div>

      {form.show && (
        <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-3 border border-slate-200">
          <p className="text-xs font-medium text-slate-700">
            {form.editing ? "Modifier le lien" : "Nouveau lien"}
          </p>

          <div className="grid grid-cols-[64px_1fr] gap-2">
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={4}
              disabled={saving}
              placeholder="🔗"
              className="rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={saving}
              placeholder="Titre"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            disabled={saving}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-900 text-white py-1.5 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "..." : form.editing ? "Enregistrer" : "Ajouter"}
            </button>
            <button
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Aucun lien. Ajoute le premier !
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="group flex items-center gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-3 p-3 min-w-0"
              >
                <span className="text-2xl flex-shrink-0">{link.icon}</span>
                <span className="font-medium text-slate-900 text-sm flex-1 truncate">
                  {link.title}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
              </a>
              <div className="flex pr-2 gap-1">
                <button
                  onClick={() => openForm(link)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded"
                  aria-label="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}