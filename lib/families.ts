// lib/families.ts

/**
 * Source unique de vérité pour les 3 familles de Kerbrise.
 * ⚠️ L'ordre du tableau FAMILIES est le cycle de rotation des priorités été.
 * Année 2024 = priorités dans cet ordre (Antoine=P1, Vincent=P2, François=P3).
 * NE PAS RÉORDONNER sans casser summer-priorities.ts.
 */

export type FamilyName = "Antoine" | "Vincent" | "François";

export type Family = {
  name: FamilyName;
  color: string; // hex pour styles inline
};

export const FAMILIES = [
  { name: "Antoine",  color: "#1E4E8C" }, // bleu océan profond (remplace blue-500)
  { name: "Vincent",  color: "#A38800" }, // ambre doux (remplace amber-500)
  { name: "François", color: "#1F5C26" }, // vert forêt (remplace emerald-500)
] as const satisfies readonly Family[];


export const FAMILY_NAMES: readonly FamilyName[] = FAMILIES.map((f) => f.name);

export const FAMILY_COLORS: Record<FamilyName, string> = Object.fromEntries(
  FAMILIES.map((f) => [f.name, f.color])
) as Record<FamilyName, string>;

/** Couleur hex d'une famille par son nom. Fallback gris si nom inconnu. */
export function getFamilyColor(name: string | null | undefined): string {
  if (!name) return "#888";
  return FAMILY_COLORS[name as FamilyName] ?? "#888";
}