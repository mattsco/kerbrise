"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Identifiants incorrects.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen relative flex items-center justify-center p-4">
      {/* Photo sunset en fond */}
      <Image
        src="/sunset.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      {/* Carte de connexion */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">
            Connexion
          </h2>

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

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="••••••••"
              />
              <Link
                href="/forgot-password"
                className="mt-1.5 inline-block text-xs text-slate-500 hover:text-slate-900 transition"
              >
                Mot de passe oublié ?
              </Link>
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
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>

        <Link
          href="/"
          className="mt-5 text-xs text-white/70 hover:text-white text-center block transition"
        >
          ← Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
