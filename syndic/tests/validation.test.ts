import { describe, it, expect } from "vitest";
import {
  residenceSchema,
  unitSchema,
  credentials,
} from "../src/lib/validation";
describe("validation des entrées", () => {
  it("refuse les mots de passe trop courts", () =>
    expect(
      credentials.safeParse({ email: "a@example.com", password: "short" })
        .success,
    ).toBe(false));
  it("refuse une organisation invalide", () =>
    expect(
      residenceSchema.safeParse({
        organization_id: "wrong",
        name: "Atlas",
        address: "Rue Atlas",
        city: "Rabat",
      }).success,
    ).toBe(false));
  it("refuse les quotes-parts invalides", () => {
    for (const share of [0, -1, "nope"])
      expect(
        unitSchema.safeParse({
          residence_id: "11111111-1111-4111-8111-111111111111",
          label: "A1",
          kind: "apartment",
          share,
        }).success,
      ).toBe(false);
  });
  it("normalise le libellé et accepte les décimales", () => {
    const result = unitSchema.parse({
      residence_id: "11111111-1111-4111-8111-111111111111",
      label: " A1 ",
      kind: "apartment",
      share: "1.25",
    });
    expect(result.label).toBe("A1");
    expect(result.share).toBe(1.25);
  });
});
