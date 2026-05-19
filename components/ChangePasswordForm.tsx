"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccess(false);

    if (newPassword.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      setSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSubmitting(false);

    if (error) {
      setErrorMsg("Erreur : " + error.message);
      return;
    }

    setSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
        Changer mon mot de passe
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            minLength={6}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Confirmation
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            minLength={6}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {submitting ? "Enregistrement..." : "Changer le mot de passe"}
        </button>

        {errorMsg && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        {success && (
          <p className="text-sm text-emerald-600">
            ✅ Mot de passe mis à jour avec succès.
          </p>
        )}
      </form>
    </div>
  );
}