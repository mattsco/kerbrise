"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    // On affiche le même message de succès quelle que soit l'issue : on ne
    // révèle pas si l'email existe (anti énumération de comptes).
    if (resetError) {
      console.error("[forgot-password]", resetError.message);
    }

    setSubmitting(false);
    setSent(true);
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4">
      <Image
        src="/sunset.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Mot de passe oublié
          </h2>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Si un compte existe pour <strong>{email}</strong>, un email
                avec un lien de réinitialisation vient d&apos;être envoyé.
                Pense à vérifier tes spams.
              </p>
              <Link
                href="/login"
                className="block w-full text-center rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 transition"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-5">
                Entre ton email : on t&apos;envoie un lien pour choisir un
                nouveau mot de passe.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="ton@email.fr"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {submitting ? "Envoi..." : "Envoyer le lien"}
                </button>
              </form>
            </>
          )}
        </div>

        <Link
          href="/login"
          className="mt-5 text-xs text-white/70 hover:text-white text-center block transition"
        >
          ← Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
