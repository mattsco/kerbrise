// supabase/functions/_shared/families.ts
//
// Source unique des couleurs famille pour les emails.
// Valeurs alignées sur la table `families` (DB) ET sur lib/families.ts (app) —
// concordance vérifiée le 2026-06-14. La DB reste la source primaire : les
// fonctions lisent `families.color` par jointure quand la valeur est dispo.
// Ce fallback ne sert QUE quand la jointure est absente/nulle.

export const FAMILY_COLORS: Record<string, string> = {
  Antoine: "#3b82f6",
  François: "#10b981",
  Vincent: "#f59e0b",
};

const FALLBACK = "#888";

/**
 * Couleur d'une famille par nom. Préférer `families.color` (DB) quand
 * disponible ; cette fonction est le filet pour les cas sans jointure.
 */
export function familyColor(name: string | null | undefined): string {
  if (!name) return FALLBACK;
  return FAMILY_COLORS[name] ?? FALLBACK;
}
