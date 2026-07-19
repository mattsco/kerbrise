import { describe, expect, it } from "vitest";
import { friendlyDbError, isConstraintViolation } from "./db-errors";

describe("friendlyDbError — mapping SQLSTATE → messages FR", () => {
  it("23505 (unique_violation) : message affiné par contexte", () => {
    expect(friendlyDbError({ code: "23505" }, "approval")).toBe(
      "Cette demande a déjà été traitée par ta famille."
    );
    expect(friendlyDbError({ code: "23505" }, "booking")).toBe(
      "Cet enregistrement existe déjà."
    );
    expect(friendlyDbError({ code: "23505" })).toBe(
      "Cet enregistrement existe déjà."
    );
  });

  it("23P01 (exclusion_violation) : message anti-chevauchement, quel que soit le contexte", () => {
    const expected =
      "Ces dates chevauchent un séjour déjà approuvé. Le calendrier a peut-être changé depuis l'envoi de la demande.";
    expect(friendlyDbError({ code: "23P01" }, "booking")).toBe(expected);
    expect(friendlyDbError({ code: "23P01" }, "approval")).toBe(expected);
  });

  it("23503 et 23514 ont leurs messages dédiés", () => {
    expect(friendlyDbError({ code: "23503" })).toContain("n'existe plus");
    expect(friendlyDbError({ code: "23514" })).toContain("règle de validation");
  });

  it("code inconnu : renvoie le message brut s'il existe, sinon le fallback", () => {
    expect(friendlyDbError({ code: "XX000", message: "boom" })).toBe("boom");
    expect(friendlyDbError({ code: "XX000", message: "   " })).toBe(
      "Une erreur est survenue. Réessaie dans un instant."
    );
    expect(friendlyDbError({ code: "XX000" })).toBe(
      "Une erreur est survenue. Réessaie dans un instant."
    );
  });

  it("erreur null/undefined → fallback générique (pas de crash)", () => {
    expect(friendlyDbError(null)).toBe(
      "Une erreur est survenue. Réessaie dans un instant."
    );
    expect(friendlyDbError(undefined)).toBe(
      "Une erreur est survenue. Réessaie dans un instant."
    );
  });
});

describe("isConstraintViolation", () => {
  it("true uniquement pour 23505 et 23P01", () => {
    expect(isConstraintViolation({ code: "23505" })).toBe(true);
    expect(isConstraintViolation({ code: "23P01" })).toBe(true);
    expect(isConstraintViolation({ code: "23503" })).toBe(false);
    expect(isConstraintViolation({ code: "XX000" })).toBe(false);
    expect(isConstraintViolation(null)).toBe(false);
  });
});
