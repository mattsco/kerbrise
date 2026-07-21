"use client";

import { LogOut } from "lucide-react";
import { purgeOfflineData } from "./ServiceWorkerRegistrar";

/**
 * Déconnexion + purge de ce que l'offline a laissé sur l'appareil (#37).
 *
 * La purge doit se faire côté client : les caches du SW et le localStorage
 * sont inaccessibles depuis la route serveur /auth/signout.
 *
 * On soumet le formulaire dans tous les cas, même si la purge échoue : rater
 * une déconnexion parce qu'un cache refuse de s'effacer serait pire que le
 * problème qu'on évite.
 */
export default function LogoutButton() {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await purgeOfflineData();
    form.submit();
  }

  return (
    <form action="/auth/signout" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition"
        aria-label="Se déconnecter"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </form>
  );
}
