"use client";

import { useEffect } from "react";
import { runWhenIdle } from "@/lib/idle";
import {
  PROFIL_KEY,
  SNAPSHOT_VERSION,
  type OfflineProfil,
} from "@/lib/offline-snapshot";

/**
 * Persiste le profil pour le mode hors ligne (spec #37, décision 19).
 *
 * Même principe que `SnapshotWriter` : **aucune requête**. Il reçoit ce que la
 * page profil a déjà chargé côté serveur et le recopie en local, une fois la
 * page affichée et le navigateur au repos.
 *
 * Monté sur `/dashboard/profil` uniquement. Qui n'y va jamais garde un profil
 * hors ligne réduit à sa famille et sa priorité, déduites du snapshot
 * calendrier — dégradation voulue, pas un échec.
 */
export default function ProfilWriter({
  displayName,
  email,
  familyName,
  roles,
  sejourCount,
}: {
  displayName: string;
  email: string | null;
  familyName: string | null;
  roles: string[];
  sejourCount: number | null;
}) {
  // `roles` est un tableau recréé à chaque rendu serveur : on dépend de son
  // CONTENU, pas de son identité, sinon l'effet se relancerait sans raison.
  const rolesKey = roles.join("|");

  useEffect(() => {
    return runWhenIdle(() => {
      const profil: OfflineProfil = {
        version: SNAPSHOT_VERSION,
        savedAt: new Date().toISOString(),
        displayName,
        email,
        familyName,
        roles: rolesKey.split("|"),
        sejourCount,
      };

      try {
        localStorage.setItem(PROFIL_KEY, JSON.stringify(profil));
      } catch {
        // Quota, navigation privée : on garde la version précédente.
      }
    });
  }, [displayName, email, familyName, rolesKey, sejourCount]);

  return null;
}
