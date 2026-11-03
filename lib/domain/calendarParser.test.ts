import { describe, expect, it } from "vitest";
import {
  normalizeDateValue,
  normalizeHolidayType,
  rowsToHolidays,
} from "./calendarParser";

describe("calendarParser", () => {
  describe("normalizeDateValue", () => {
    it("handles ISO dates", () => {
      expect(normalizeDateValue("2026-12-25")).toBe("2026-12-25");
    });

    it("handles French dates DD/MM/YYYY", () => {
      expect(normalizeDateValue("25/12/2026")).toBe("2026-12-25");
      expect(normalizeDateValue("01/01/2027")).toBe("2027-01-01");
    });

    it("handles JavaScript Date instances", () => {
      const d = new Date(2026, 11, 25); // month 11 is December
      expect(normalizeDateValue(d)).toBe("2026-12-25");
    });

    it("returns null for invalid dates", () => {
      expect(normalizeDateValue("invalide")).toBeNull();
      expect(normalizeDateValue("")).toBeNull();
      expect(normalizeDateValue(null)).toBeNull();
    });
  });

  describe("normalizeHolidayType", () => {
    it("recognizes holiday and vacation variants", () => {
      expect(normalizeHolidayType("Jour férié")).toBe("holiday");
      expect(normalizeHolidayType("Férié")).toBe("holiday");
      expect(normalizeHolidayType("holiday")).toBe("holiday");
      expect(normalizeHolidayType("Vacances / fermeture")).toBe("vacation");
      expect(normalizeHolidayType("Vacances")).toBe("vacation");
      expect(normalizeHolidayType("Fermeture")).toBe("vacation");
      expect(normalizeHolidayType(null)).toBe("vacation");
    });
  });

  describe("rowsToHolidays", () => {
    it("parses valid rows with both dates", () => {
      const rows = [
        ["Intitulé", "Type", "Premier jour", "Dernier jour"],
        ["Vacances de Noël", "Vacances / fermeture", "2026-12-19", "2027-01-03"],
        ["Jour de l'an", "Jour férié", "2027-01-01", ""],
      ];
      const result = rowsToHolidays(rows);
      expect(result.errors).toHaveLength(0);
      expect(result.holidays).toHaveLength(2);

      expect(result.holidays[0]).toEqual({
        line: 2,
        title: "Vacances de Noël",
        type: "vacation",
        startDate: "2026-12-19",
        endDate: "2027-01-03",
      });

      // Single day: endDate defaults to startDate
      expect(result.holidays[1]).toEqual({
        line: 3,
        title: "Jour de l'an",
        type: "holiday",
        startDate: "2027-01-01",
        endDate: "2027-01-01",
      });
    });

    it("detects invalid date range (endDate < startDate)", () => {
      const rows = [
        ["Intitulé", "Type", "Premier jour", "Dernier jour"],
        ["Période incohérente", "Vacances", "2026-12-25", "2026-12-20"],
      ];
      const result = rowsToHolidays(rows);
      expect(result.holidays).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("ne peut pas être antérieure");
    });

    it("detects duplicates in file", () => {
      const rows = [
        ["Intitulé", "Type", "Premier jour", "Dernier jour"],
        ["Pont", "Vacances", "2026-05-15", "2026-05-15"],
        ["Pont", "Vacances", "2026-05-15", "2026-05-15"],
      ];
      const result = rowsToHolidays(rows);
      expect(result.holidays).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("doublon");
    });

    it("reports missing required columns", () => {
      const rows = [
        ["Autre", "Chose"],
        ["Valeur 1", "Valeur 2"],
      ];
      const result = rowsToHolidays(rows);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Colonne introuvable");
    });
  });
});
