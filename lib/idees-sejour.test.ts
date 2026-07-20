import { describe, expect, it } from "vitest";
import { IDEES_SEJOUR, pickIdeeSejour } from "./idees-sejour";

describe("pickIdeeSejour", () => {
  it("renvoie la première idée pour random() = 0", () => {
    expect(pickIdeeSejour(() => 0)).toBe(IDEES_SEJOUR[0]);
  });

  it("renvoie la dernière idée juste avant 1", () => {
    expect(pickIdeeSejour(() => 0.999)).toBe(
      IDEES_SEJOUR[IDEES_SEJOUR.length - 1]
    );
  });

  it("ne sort pas du tableau si random() renvoie 1", () => {
    expect(IDEES_SEJOUR).toContain(pickIdeeSejour(() => 1));
  });

  it("couvre bien tout le tableau", () => {
    const tirees = IDEES_SEJOUR.map((_, i) =>
      pickIdeeSejour(() => i / IDEES_SEJOUR.length)
    );
    expect(tirees).toEqual([...IDEES_SEJOUR]);
  });

  it("renvoie toujours une idée de la liste", () => {
    for (let i = 0; i < 50; i++) {
      expect(IDEES_SEJOUR).toContain(pickIdeeSejour());
    }
  });
});
