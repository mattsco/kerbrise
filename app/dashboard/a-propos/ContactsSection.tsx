"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSyncedState } from "@/lib/hooks";
import { Phone, Pencil, Trash2, Plus } from "lucide-react";

export type Contact = {
  id: string;
  label: string;
  name: string | null;
  phone: string | null;
  icon: string;
  position: number;
};

type Props = {
  initialContacts: Contact[];
  currentUserId: string;
};

type ContactForm = {
  show: boolean;
  editing: Contact | null;
  label: string;
  name: string;
  phone: string;
  icon: string;
};

const EMPTY_FORM: ContactForm = {
  show: false,
  editing: null,
  label: "",
  name: "",
  phone: "",
  icon: "📞",
};

export default function ContactsSection({
  initialContacts,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [contacts] = useSyncedState<Contact[]>(initialContacts);

  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openForm(contact: Contact | null = null) {
    setForm({
      show: true,
      editing: contact,
      label: contact?.label ?? "",
      name: contact?.name ?? "",
      phone: contact?.phone ?? "",
      icon: contact?.icon ?? "📞",
    });
    setError("");
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setError("");
  }

  async function save() {
    setError("");
    if (!form.label.trim()) {
      setError("Label obligatoire (ex: Jardinier).");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    if (form.editing) {
      await supabase
        .from("house_contacts")
        .update({
          label: form.label.trim(),
          name: form.name.trim() || null,
          phone: form.phone.trim() || null,
          icon: form.icon.trim() || "📞",
        })
        .eq("id", form.editing.id);
    } else {
      await supabase.from("house_contacts").insert({
        label: form.label.trim(),
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        icon: form.icon.trim() || "📞",
        created_by: currentUserId,
        position: contacts.length,
      });
    }

    setSaving(false);
    closeForm();
    router.refresh();
  }

  async function deleteContact(id: string) {
    if (!confirm("Supprimer ce contact ?")) return;
    const supabase = createClient();
    await supabase.from("house_contacts").delete().eq("id", id);
    router.refresh();
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          📞 Contacts utiles
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
            {form.editing ? "Modifier le contact" : "Nouveau contact"}
          </p>

          <div className="grid grid-cols-[64px_1fr] gap-2">
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              maxLength={4}
              disabled={saving}
              placeholder="📞"
              className="rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              disabled={saving}
              placeholder="Rôle (ex: Jardinier)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={saving}
            placeholder="Nom (optionnel)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={saving}
            placeholder="Téléphone (optionnel)"
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

      {contacts.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Aucun contact. Ajoute le premier !
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 p-3"
            >
              <span className="text-2xl flex-shrink-0">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{c.label}</p>
                {c.name && (
                  <p className="text-xs text-slate-600 truncate">{c.name}</p>
                )}
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 flex-shrink-0"
                >
                  <Phone className="w-3 h-3" />
                  <span className="hidden sm:inline">{c.phone}</span>
                </a>
              )}
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => openForm(c)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded"
                  aria-label="Modifier"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteContact(c.id)}
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