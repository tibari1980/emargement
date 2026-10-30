import { downloadBlob } from "@/lib/core/apiClient";

export const SAMPLE_TRAINEES_DATA = [
  { lastName: "Dupont", firstName: "Claire", email: "claire.dupont@exemple.fr" },
  { lastName: "Martin", firstName: "Lucas", email: "lucas.martin@exemple.fr" },
  { lastName: "Benali", firstName: "Youssef", email: "youssef.benali@exemple.fr" },
  { lastName: "Leroy", firstName: "Camille", email: "camille.leroy@exemple.fr" },
  { lastName: "Moreau", firstName: "Thomas", email: "thomas.moreau@exemple.fr" },
];

/**
 * Downloads a pre-formatted CSV template directly in the browser (UTF-8 with BOM).
 * Uses semicolon ';' delimiter which is standard for French Microsoft Excel.
 */
export function downloadTraineeCsvTemplate(): void {
  const header = "Nom;Prénom;Email\r\n";
  const rows = SAMPLE_TRAINEES_DATA.map((t) => `${t.lastName};${t.firstName};${t.email}`).join("\r\n");
  const content = "\ufeff" + header + rows + "\r\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, "modele_import_stagiaires.csv");
}

/**
 * Downloads a styled Microsoft Excel template (.xlsx).
 */
export async function downloadTraineeExcelTemplate(): Promise<void> {
  const response = await fetch("/api/templates/trainees?format=xlsx");
  if (!response.ok) {
    throw new Error("Impossible de générer le fichier modèle Excel.");
  }
  const blob = await response.blob();
  downloadBlob(blob, "modele_import_stagiaires.xlsx");
}
