"use client";

import { useState } from "react";
import NextCollections from "./NextCollections";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ExternalLink,
  Phone,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Wifi,
} from "lucide-react";

type Intro = {
  id: string;
  content: string;
  updated_at: string;
  users?: { display_name: string | null } | { display_name: string | null }[] | null;
} | null;


type Link = {
  id: string;
  title: string;
  url: string;
  icon: string;
  position: number;
};

type Contact = {
  id: string;
  label: string;
  name: string | null;
  phone: string | null;
  icon: string;
  position: number;
};

type Props = {
  initialIntro: Intro;
  initialLinks: Link[];
  initialContacts: Contact[];
  currentUserId: string;
  showCollections: boolean;
};

export default function AProposClient({
  initialIntro,
  initialLinks,
  initialContacts,
  currentUserId,
  showCollections,
}: Props) {
  const router = useRouter();

// ===========================
  // WIFI
  // ===========================
  const [wifiCopied, setWifiCopied] = useState(false);

  async function copyWifiPassword() {
    try {
      await navigator.clipboard.writeText("kerbrise35400");
      setWifiCopied(true);
      setTimeout(() => setWifiCopied(false), 2000);
    } catch {
      // Fallback navigateurs anciens
      const textArea = document.createElement("textarea");
      textArea.value = "kerbrise35400";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setWifiCopied(true);
      setTimeout(() => setWifiCopied(false), 2000);
    }
  }

  // ===========================
  // SECTION 1 : INTRO
  // ===========================
  const [intro, setIntro] = useState<Intro>(initialIntro);
  const [editingIntro, setEditingIntro] = useState(false);
  const [introContent, setIntroContent] = useState(
    initialIntro?.content ?? ""
  );
  const [savingIntro, setSavingIntro] = useState(false);

  async function saveIntro() {
    setSavingIntro(true);
    const supabase = createClient();
    if (intro) {
      await supabase
        .from("house_intro")
        .update({
          content: introContent,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intro.id);
    } else {
      await supabase.from("house_intro").insert({
        content: introContent,
        updated_by: currentUserId,
      });
    }
    setSavingIntro(false);
    setEditingIntro(false);
    router.refresh();
  }

  // ===========================
  // SECTION 2 : LINKS
  // ===========================
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [linkForm, setLinkForm] = useState<{
    show: boolean;
    editing: Link | null;
    title: string;
    url: string;
    icon: string;
  }>({
    show: false,
    editing: null,
    title: "",
    url: "",
    icon: "🔗",
  });
  const [linkError, setLinkError] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  function openLinkForm(link: Link | null = null) {
    setLinkForm({
      show: true,
      editing: link,
      title: link?.title ?? "",
      url: link?.url ?? "",
      icon: link?.icon ?? "🔗",
    });
    setLinkError("");
  }

  function closeLinkForm() {
    setLinkForm({
      show: false,
      editing: null,
      title: "",
      url: "",
      icon: "🔗",
    });
    setLinkError("");
  }

  async function saveLink() {
    setLinkError("");
    if (!linkForm.title.trim() || !linkForm.url.trim()) {
      setLinkError("Titre et URL obligatoires.");
      return;
    }
    try {
      new URL(linkForm.url);
    } catch {
      setLinkError("URL invalide (doit commencer par http:// ou https://).");
      return;
    }

    setSavingLink(true);
    const supabase = createClient();

    if (linkForm.editing) {
      await supabase
        .from("house_links")
        .update({
          title: linkForm.title.trim(),
          url: linkForm.url.trim(),
          icon: linkForm.icon.trim() || "🔗",
        })
        .eq("id", linkForm.editing.id);
    } else {
      await supabase.from("house_links").insert({
        title: linkForm.title.trim(),
        url: linkForm.url.trim(),
        icon: linkForm.icon.trim() || "🔗",
        created_by: currentUserId,
        position: links.length,
      });
    }

    setSavingLink(false);
    closeLinkForm();
    router.refresh();
  }

  async function deleteLink(id: string) {
    if (!confirm("Supprimer ce lien ?")) return;
    const supabase = createClient();
    await supabase.from("house_links").delete().eq("id", id);
    router.refresh();
  }


  // ===========================
  // SECTION 3 : CONTACTS
  // ===========================
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [contactForm, setContactForm] = useState<{
    show: boolean;
    editing: Contact | null;
    label: string;
    name: string;
    phone: string;
    icon: string;
  }>({
    show: false,
    editing: null,
    label: "",
    name: "",
    phone: "",
    icon: "📞",
  });
  const [contactError, setContactError] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  function openContactForm(contact: Contact | null = null) {
    setContactForm({
      show: true,
      editing: contact,
      label: contact?.label ?? "",
      name: contact?.name ?? "",
      phone: contact?.phone ?? "",
      icon: contact?.icon ?? "📞",
    });
    setContactError("");
  }

  function closeContactForm() {
    setContactForm({
      show: false,
      editing: null,
      label: "",
      name: "",
      phone: "",
      icon: "📞",
    });
    setContactError("");
  }

  async function saveContact() {
    setContactError("");
    if (!contactForm.label.trim()) {
      setContactError("Label obligatoire (ex: Jardinier).");
      return;
    }

    setSavingContact(true);
    const supabase = createClient();

    if (contactForm.editing) {
      await supabase
        .from("house_contacts")
        .update({
          label: contactForm.label.trim(),
          name: contactForm.name.trim() || null,
          phone: contactForm.phone.trim() || null,
          icon: contactForm.icon.trim() || "📞",
        })
        .eq("id", contactForm.editing.id);
    } else {
      await supabase.from("house_contacts").insert({
        label: contactForm.label.trim(),
        name: contactForm.name.trim() || null,
        phone: contactForm.phone.trim() || null,
        icon: contactForm.icon.trim() || "📞",
        created_by: currentUserId,
        position: contacts.length,
      });
    }

    setSavingContact(false);
    closeContactForm();
    router.refresh();
  }

  async function deleteContact(id: string) {
    if (!confirm("Supprimer ce contact ?")) return;
    const supabase = createClient();
    await supabase.from("house_contacts").delete().eq("id", id);
    router.refresh();
  }

  // ===========================
  // RENDU
  // ===========================
  return (
    <div className="space-y-5">
      {/* SECTION 1 : INTRO */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            📖 Bienvenue à Kerbrise
          </h2>
          {!editingIntro && (
            <button
              onClick={() => {
                setIntroContent(intro?.content ?? "");
                setEditingIntro(true);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Modifier
            </button>
          )}
        </div>

        {editingIntro ? (
          <div className="space-y-3">
            <textarea
              value={introContent}
              onChange={(e) => setIntroContent(e.target.value)}
              rows={8}
              placeholder="Écris ici ce que tu veux partager sur la maison..."
              disabled={savingIntro}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                onClick={saveIntro}
                disabled={savingIntro}
                className="flex-1 rounded-lg bg-slate-900 text-white py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                {savingIntro ? "..." : "Enregistrer"}
              </button>
              <button
                onClick={() => {
                  setEditingIntro(false);
                  setIntroContent(intro?.content ?? "");
                }}
                disabled={savingIntro}
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
                Aucun contenu encore. Clique "Modifier" pour ajouter une présentation.
              </p>
            )}

{(() => {
              const updater = Array.isArray(intro?.users)
                ? intro?.users[0]
                : intro?.users;
              if (!updater?.display_name) return null;
              return (
                <p className="text-[10px] text-slate-400 mt-3">
                  Mis à jour par {updater.display_name} ·{" "}
                  {new Date(intro!.updated_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              );
            })()}

            {/* Bouton wifi */}
            <button
              onClick={copyWifiPassword}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
            >
              <Wifi className="w-3.5 h-3.5" />
              {wifiCopied
                ? "Mot de passe copié ✓"
                : "Copier le mot de passe wifi"}
            </button>
          </>
        )}
      </section>

      {/* SECTION COLLECTES (conditionnel) */}
      <NextCollections compact={!showCollections} />

            
      {/* SECTION 2 : LINKS */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            🔗 Liens utiles
          </h2>
          {!linkForm.show && (
            <button
              onClick={() => openLinkForm()}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          )}
        </div>

        {/* Formulaire link */}
        {linkForm.show && (
          <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-700">
              {linkForm.editing ? "Modifier le lien" : "Nouveau lien"}
            </p>

            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input
                type="text"
                value={linkForm.icon}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, icon: e.target.value })
                }
                maxLength={4}
                disabled={savingLink}
                placeholder="🔗"
                className="rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                value={linkForm.title}
                onChange={(e) =>
                  setLinkForm({ ...linkForm, title: e.target.value })
                }
                disabled={savingLink}
                placeholder="Titre"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <input
              type="url"
              value={linkForm.url}
              onChange={(e) =>
                setLinkForm({ ...linkForm, url: e.target.value })
              }
              disabled={savingLink}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {linkError && (
              <p className="text-xs text-red-600">{linkError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={saveLink}
                disabled={savingLink}
                className="flex-1 rounded-lg bg-slate-900 text-white py-1.5 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {savingLink ? "..." : linkForm.editing ? "Enregistrer" : "Ajouter"}
              </button>
              <button
                onClick={closeLinkForm}
                disabled={savingLink}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Grille de liens */}
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
                    onClick={() => openLinkForm(link)}
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

      {/* SECTION 3 : CONTACTS */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            📞 Contacts utiles
          </h2>
          {!contactForm.show && (
            <button
              onClick={() => openContactForm()}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          )}
        </div>

        {/* Formulaire contact */}
        {contactForm.show && (
          <div className="bg-slate-50 rounded-xl p-3 mb-3 space-y-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-700">
              {contactForm.editing ? "Modifier le contact" : "Nouveau contact"}
            </p>

            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input
                type="text"
                value={contactForm.icon}
                onChange={(e) =>
                  setContactForm({ ...contactForm, icon: e.target.value })
                }
                maxLength={4}
                disabled={savingContact}
                placeholder="📞"
                className="rounded-lg border border-slate-300 px-2 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="text"
                value={contactForm.label}
                onChange={(e) =>
                  setContactForm({ ...contactForm, label: e.target.value })
                }
                disabled={savingContact}
                placeholder="Rôle (ex: Jardinier)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <input
              type="text"
              value={contactForm.name}
              onChange={(e) =>
                setContactForm({ ...contactForm, name: e.target.value })
              }
              disabled={savingContact}
              placeholder="Nom (optionnel)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input
              type="tel"
              value={contactForm.phone}
              onChange={(e) =>
                setContactForm({ ...contactForm, phone: e.target.value })
              }
              disabled={savingContact}
              placeholder="Téléphone (optionnel)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />

            {contactError && (
              <p className="text-xs text-red-600">{contactError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={saveContact}
                disabled={savingContact}
                className="flex-1 rounded-lg bg-slate-900 text-white py-1.5 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
              >
                {savingContact
                  ? "..."
                  : contactForm.editing
                  ? "Enregistrer"
                  : "Ajouter"}
              </button>
              <button
                onClick={closeContactForm}
                disabled={savingContact}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste contacts */}
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
                  <p className="font-medium text-slate-900 text-sm">
                    {c.label}
                  </p>
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
                    onClick={() => openContactForm(c)}
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
    </div>
  );
}