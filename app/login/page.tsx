"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-light tracking-tight mb-2">Kerbrise</h1>
        <p className="text-sm text-slate-500 mb-6">
          Connexion par email
        </p>

        {status === "sent" ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            ✉️ Un lien de connexion a été envoyé à <strong>{email}</strong>.
            <br />
            <br />
            Ouvre l'email et clique sur le lien pour te connecter. (Pense à
            regarder les spams si tu ne le vois pas.)
          </div>
        ) : (
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
                disabled={status === "sending"}
                placeholder="prenom@example.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {status === "sending" ? "Envoi..." : "Recevoir le lien"}
            </button>

            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
          </form>
        )}

        <p className="mt-6 text-xs text-slate-400 text-center">
          Réservé aux familles Antoine, François et Vincent.
        </p>
      </div>
    </main>
  );
}