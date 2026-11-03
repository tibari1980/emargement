import { downloadBlob } from "@/lib/core/apiClient";

export const SAMPLE_CALENDAR_DATA = [
  { title: "Vacances d'Hiver", type: "Vacances / fermeture", startDate: "2027-02-13", endDate: "2027-02-28" },
  { title: "Pont de l'Ascension", type: "Vacances / fermeture", startDate: "2027-05-07", endDate: "2027-05-07" },
  { title: "Journée Pédagogique", type: "Vacances / fermeture", startDate: "2027-06-18", endDate: "2027-06-18" },
  { title: "Fermeture Estivale", type: "Vacances / fermeture", startDate: "2027-07-24", endDate: "2027-08-22" },
  { title: "Fête du Travail", type: "Jour férié", startDate: "2027-05-01", endDate: "2027-05-01" },
];

/**
 * Downloads a pre-formatted Calendar CSV template (UTF-8 with BOM).
 */
export function downloadCalendarCsvTemplate(): void {
  const header = "Intitulé;Type;Premier jour;Dernier jour\r\n";
  const rows = SAMPLE_CALENDAR_DATA.map((c) => `${c.title};${c.type};${c.startDate};${c.endDate}`).join("\r\n");
  const content = "\ufeff" + header + rows + "\r\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, "modele_import_calendrier.csv");
}

/**
 * Downloads a styled Microsoft Excel template for calendar (.xlsx).
 */
export async function downloadCalendarExcelTemplate(): Promise<void> {
  const response = await fetch("/api/templates/calendar?format=xlsx");
  if (!response.ok) {
    throw new Error("Impossible de générer le fichier modèle Excel pour le calendrier.");
  }
  const blob = await response.blob();
  downloadBlob(blob, "modele_import_calendrier.xlsx");
}

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
