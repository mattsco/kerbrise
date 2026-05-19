"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (error) {
      setSubmitting(false);
      setErrorMsg("Email ou mot de passe incorrect.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-light tracking-tight mb-2">Kerbrise</h1>
        <p className="text-sm text-slate-500 mb-6">Connexion</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="prenom@example.com"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {submitting ? "Connexion..." : "Se connecter"}
          </button>

          {errorMsg && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}
        </form>

        <p className="mt-6 text-xs text-slate-400 text-center">
          Réservé aux familles Antoine, François et Vincent.<br />
          Identifiants oubliés ? Contacte Matthieu.
        </p>
      </div>
    </main>
  );
}