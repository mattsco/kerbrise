"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Le lien de l'email arrive avec un token de récupération dans le hash
  // (#access_token=...&type=recovery), capté automatiquement par le client
  // Supabase (flow implicit, detectSessionInUrl). On attend que la session
  // de récupération soit établie avant d'autoriser le changement de mdp.
  useEffect(() => {
    const supabase = createClient();

    // Cas erreur explicite renvoyée dans le hash (lien expiré / déjà utilisé)
    if (typeof window !== "undefined" && window.location.hash.includes("error")) {
      setStatus("invalid");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setStatus("ready");
      }
    });

    // Filet de sécurité : vérifie la session déjà présente après parsing du hash
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("ready");
      } else {
        // Laisse une fenêtre au parsing du hash avant de déclarer invalide
        setTimeout(() => {
          setStatus((s) => (s === "checking" ? "invalid" : s));
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

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
    const { error: pwError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (pwError) {
      setSubmitting(false);
      setErrorMsg("Erreur : " + pwError.message);
      return;
    }

    // Marque password_changed = true (cohérent avec ChangePasswordForm)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ password_changed: true })
        .eq("id", user.id);
    }

    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
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
          <h2 className="text-lg font-semibold text-slate-900 mb-5">
            Nouveau mot de passe
          </h2>

          {status === "checking" && (
            <p className="text-sm text-slate-500">Vérification du lien…</p>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Ce lien est invalide ou a expiré. Demande-en un nouveau.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full text-center rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 transition"
              >
                Renvoyer un lien
              </Link>
            </div>
          )}

          {status === "ready" && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirmation
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {submitting ? "Enregistrement…" : "Valider"}
              </button>
            </form>
          )}

          {success && (
            <p className="text-sm text-emerald-600">
              ✅ Mot de passe mis à jour. Redirection…
            </p>
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
