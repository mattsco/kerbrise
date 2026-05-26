"use client";

import { useState } from "react";
import { submitFeatureRequest } from "./actions";
import { Send, Check } from "lucide-react";

export default function FeatureRequestForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError("");

    if (title.trim().length < 3) {
      setError("Donne un titre court (au moins 3 caractères).");
      return;
    }
    if (description.trim().length < 10) {
      setError("Détaille un peu plus ton idée (au moins 10 caractères).");
      return;
    }

    setSubmitting(true);
    const result = await submitFeatureRequest(title, description);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSuccess(true);
    setTitle("");
    setDescription("");

    // Reset le message succès après 4s
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Titre court
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          maxLength={100}
          placeholder="Ex: Pouvoir ajouter une photo aux séjours"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Détails
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          maxLength={2000}
          rows={4}
          placeholder="Pourquoi ce serait utile ? Quel cas d'usage ?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        />
        <p className="text-[10px] text-slate-400 mt-1 text-right">
          {description.length} / 2000
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
          {error}
        </p>
      )}

      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2.5 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Merci, ta suggestion est bien arrivée !
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !description.trim()}
        className="w-full rounded-lg bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send className="w-3.5 h-3.5" />
        {submitting ? "Envoi..." : "Envoyer ma suggestion"}
      </button>
    </div>
  );
}