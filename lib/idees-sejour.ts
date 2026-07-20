// lib/idees-sejour.ts
//
// Petit easter egg : le champ « Note » d'une nouvelle demande suggère une idée
// d'activité du coin plutôt qu'un « Ex: Vacances de Noël en famille » générique.
// Une idée au hasard à chaque ouverture du formulaire.
//
// Liste écrite par la famille — à enrichir librement, l'ordre n'a pas d'importance.

export const IDEES_SEJOUR = [
  "Aller à la pêche aux lançons",
  "Aller pêcher la crevette à marée basse",
  "Ramasser des coquillages à marée basse",
  "Faire du canoë jusqu'à Bénétin",
  "Construire le plus grand bassin de la plage du Val",
  "Aller voir les grandes marées à Saint-Malo",
  "S'offrir un festin au Bénétin",
  "Faire du shopping intra-muros",
  "Marcher jusqu'à la Croix de Rothéneuf",
  "Voir le rayon vert depuis la plage du Val",
  "Tester toutes les crêperies de Saint-Malo",
] as const;

export type IdeeSejour = (typeof IDEES_SEJOUR)[number];

/**
 * Une idée au hasard. `random` est injectable pour les tests.
 *
 * ⚠️ À n'appeler que côté client APRÈS le montage (useEffect) : tirer au sort
 * pendant le rendu donnerait une valeur différente entre le serveur et le
 * client, donc une erreur d'hydratation.
 */
export function pickIdeeSejour(random: () => number = Math.random): IdeeSejour {
  const index = Math.floor(random() * IDEES_SEJOUR.length);
  // Garde-fou : random() === 1 (hors spec mais possible avec un mock) sortirait
  // du tableau.
  return IDEES_SEJOUR[Math.min(index, IDEES_SEJOUR.length - 1)];
}
