import { describe, expect, it } from "vitest";
import { frenchPublicHolidays } from "./frenchHolidays";

describe("frenchPublicHolidays", () => {
  it("computes Easter-based holidays", () => {
    const dates = Object.fromEntries(frenchPublicHolidays(2026).map((h) => [h.title, h.date]));
    expect(dates["Lundi de Pâques"]).toBe("2026-04-06");
    expect(dates["Ascension"]).toBe("2026-05-14");
    expect(dates["Lundi de Pentecôte"]).toBe("2026-05-25");
  });

  it("returns the 11 public holidays", () => {
    expect(frenchPublicHolidays(2027)).toHaveLength(11);
    expect(frenchPublicHolidays(2027).find((h) => h.title === "Lundi de Pâques")?.date).toBe("2027-03-29");
  });
});
