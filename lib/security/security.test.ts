import { describe, expect, it } from "vitest";
import { validatePassword } from "./password";
import { sanitizeForSpreadsheet, sanitizeText } from "./sanitize";

describe("Security: Password Policy (ANSSI / CNIL)", () => {
  it("rejects passwords under 10 characters", () => {
    const res = validatePassword("Ab1!short");
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Le mot de passe doit comporter au moins 10 caractères.");
  });

  it("rejects passwords with fewer than 3 character types", () => {
    const res = validatePassword("alllowercasepassword1234");
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/au moins 3 types de caractères/);
  });

  it("accepts strong passwords meeting ANSSI standards", () => {
    const res = validatePassword("ValentinHauy#2026Safe!");
    expect(res.valid).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(3);
    expect(res.tone).toBe("success");
    expect(res.errors.length).toBe(0);
  });
});

describe("Security: Spreadsheet Formula Injection Mitigation (CWE-1236)", () => {
  it("neutralizes dangerous formula prefixes (=, +, -, @, tab, cr)", () => {
    expect(sanitizeForSpreadsheet("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeForSpreadsheet("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(sanitizeForSpreadsheet("-123+calc()")).toBe("'-123+calc()");
    expect(sanitizeForSpreadsheet("@HYPERLINK(\"http://evil.com\")")).toBe("'@HYPERLINK(\"http://evil.com\")");
  });

  it("leaves safe regular text untouched", () => {
    expect(sanitizeForSpreadsheet("Jean Dupont")).toBe("Jean Dupont");
    expect(sanitizeForSpreadsheet("Formation Dév Web")).toBe("Formation Dév Web");
    expect(sanitizeForSpreadsheet(1234)).toBe(1234);
    expect(sanitizeForSpreadsheet(null)).toBe(null);
  });
});

describe("Security: Text input sanitization", () => {
  it("strips unprintable control characters and trims", () => {
    const malicious = "  Test\x00Name\x08With\x1FControlChars  ";
    expect(sanitizeText(malicious)).toBe("TestNameWithControlChars");
  });
});
