/**
 * Password Security Policy & Entropy Evaluation.
 * Aligned with ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information)
 * and CNIL guidelines for personal data protection.
 */

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0 (très faible) to 4 (très robuste)
  label: string;
  tone: "error" | "warning" | "success";
  errors: string[];
}

export const PASSWORD_REQUIREMENTS = [
  "Au moins 10 caractères (12 recommandés par l'ANSSI)",
  "Au moins une lettre majuscule (A-Z)",
  "Au moins une lettre minuscule (a-z)",
  "Au moins un chiffre (0-9)",
  "Au moins un caractère spécial (!@#$%^&*()_+-=[]{}|;:,.<>?)"
];

/**
 * Validates a password against ANSSI / CNIL security standards.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const trimmed = password || "";

  if (trimmed.length < 10) {
    errors.push("Le mot de passe doit comporter au moins 10 caractères.");
  }

  const hasUpper = /[A-Z]/.test(trimmed);
  const hasLower = /[a-z]/.test(trimmed);
  const hasDigit = /[0-9]/.test(trimmed);
  const hasSpecial = /[^A-Za-z0-9]/.test(trimmed);

  const characterTypesCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

  if (characterTypesCount < 3) {
    errors.push(
      "Le mot de passe doit combiner au moins 3 types de caractères différents (majuscules, minuscules, chiffres, caractères spéciaux)."
    );
  }

  // Calculate score (0 to 4)
  let score = 0;
  if (trimmed.length >= 8) score++;
  if (trimmed.length >= 10 && characterTypesCount >= 2) score++;
  if (trimmed.length >= 12 && characterTypesCount >= 3) score++;
  if (trimmed.length >= 14 && characterTypesCount === 4) score++;

  let label = "Très faible";
  let tone: "error" | "warning" | "success" = "error";

  switch (score) {
    case 0:
    case 1:
      label = "Faible";
      tone = "error";
      break;
    case 2:
      label = "Moyen";
      tone = "warning";
      break;
    case 3:
      label = "Fort";
      tone = "success";
      break;
    case 4:
      label = "Très fort (recommandé ANSSI)";
      tone = "success";
      break;
  }

  return {
    valid: errors.length === 0,
    score,
    label,
    tone,
    errors,
  };
}
