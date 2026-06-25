/**
 * Traduction des erreurs Postgres/PostgREST en messages français lisibles.
 *
 * Depuis les migrations 0001 (UNIQUE approvals(booking_id, family_id)) et
 * 0002 (EXCLUDE anti-chevauchement sur bookings approved), la base renvoie
 * désormais des violations de contrainte BRUTES que l'UI doit traduire :
 *   - 23505 = unique_violation   (une famille re-vote la même demande)
 *   - 23P01 = exclusion_violation (un séjour approuvé en chevauche un autre)
 *
 * On matche sur le CODE SQLSTATE (`error.code`), pas sur le texte du message :
 * le texte est localisable et change entre versions de Postgres, le code non.
 */

// Forme minimale commune à PostgrestError (client JS) et aux erreurs throw
// côté server action. On ne dépend volontairement d'aucun type Supabase ici.
export type DbLikeError =
  | { code?: string | null; message?: string | null }
  | null
  | undefined;

export type DbErrorContext = "approval" | "booking" | "generic";

const FALLBACK = "Une erreur est survenue. Réessaie dans un instant.";

const OVERLAP_MESSAGE =
  "Ces dates chevauchent un séjour déjà approuvé. Le calendrier a peut-être changé depuis l'envoi de la demande.";

/**
 * Renvoie un message utilisateur en français pour une erreur DB.
 * @param error   l'erreur (PostgrestError, ou objet `{ code, message }`)
 * @param context affine le message du 23505 selon ce qu'on écrivait
 */
export function friendlyDbError(
  error: DbLikeError,
  context: DbErrorContext = "generic"
): string {
  const code = error?.code ?? "";

  switch (code) {
    case "23505": // unique_violation
      if (context === "approval") {
        return "Cette demande a déjà été traitée par ta famille.";
      }
      return "Cet enregistrement existe déjà.";

    case "23P01": // exclusion_violation (anti-chevauchement)
      return OVERLAP_MESSAGE;

    case "23503": // foreign_key_violation
      return "L'élément lié n'existe plus. Recharge la page et réessaie.";

    case "23514": // check_violation
      return "Les données ne respectent pas une règle de validation.";

    default:
      // Pas de fuite de stack technique anglaise : on ne renvoie le message
      // brut que s'il existe, sinon un fallback générique.
      return error?.message?.trim() || FALLBACK;
  }
}

/** True si l'erreur est une violation de contrainte attendue (gérable côté UI). */
export function isConstraintViolation(error: DbLikeError): boolean {
  const code = error?.code ?? "";
  return code === "23505" || code === "23P01";
}
