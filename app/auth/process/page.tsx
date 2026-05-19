"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthProcessPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      // Le SDK Supabase lit automatiquement le token depuis le hash de l'URL
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/login?error=session_failed");
      } else {
        router.replace("/dashboard");
      }
    }

    // Petit délai pour laisser le SDK traiter le hash
    setTimeout(checkSession, 500);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-500">Connexion en cours...</p>
    </main>
  );
}