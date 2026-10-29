import { describe, expect, it } from "vitest";
import { rowsToTrainees } from "./csvParser";

describe("rowsToTrainees", () => {
  it("reads Nom / Prénom / Email columns whatever their case and accents", () => {
    const { trainees, errors } = rowsToTrainees([
      ["NOM", "Prénom", "Courriel"],
      ["Dupont", "Jean", "Jean.Dupont@Exemple.fr"],
      ["Martin", "Amélie", ""],
    ]);
    expect(errors).toEqual([]);
    expect(trainees).toEqual([
      { line: 2, fullName: "Jean Dupont", email: "jean.dupont@exemple.fr" },
      { line: 3, fullName: "Amélie Martin", email: null },
    ]);
  });

  it("accepts a single full name column and skips blank lines", () => {
    const { trainees } = rowsToTrainees([[], ["Nom complet"], ["  Léa   Bernard "], ["", ""]]);
    expect(trainees).toEqual([{ line: 3, fullName: "Léa Bernard", email: null }]);
  });

  it("reports invalid emails, missing names and duplicates with line numbers", () => {
    const { trainees, errors } = rowsToTrainees([
      ["Nom", "Prénom", "Email"],
      ["Dupont", "Jean", "pas-un-email"],
      ["", "", "x@y.fr"],
      ["Martin", "Paul", "paul@y.fr"],
      ["Martin", "Paul", "paul@y.fr"],
    ]);
    expect(trainees).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 5]);
  });

  it("explains when the header is not recognised", () => {
    const { errors } = rowsToTrainees([["Identifiant", "Groupe"], ["12", "A"]]);
    expect(errors[0].message).toMatch(/Colonnes introuvables/);
  });
});
