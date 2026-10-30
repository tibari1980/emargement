import "server-only";

import type { MonthlyReport } from "@/lib/domain/hoursCalculator";
import { MonthlyReportPayloadSchema } from "@/lib/domain/schemas";
import { HttpError } from "./auth";

/**
 * Reads the monthly report computed by the browser (lib/domain/hoursCalculator.ts,
 * from data the user is allowed to read) and validates its shape with Zod before export.
 */
export async function readReport(request: Request): Promise<MonthlyReport> {
  const json = await request.json().catch(() => null);
  const parsed = MonthlyReportPayloadSchema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(400, "Rapport invalide : données manquantes ou corrompues.");
  }
  return parsed.data.report as unknown as MonthlyReport;
}

export function exportFileName(report: MonthlyReport, extension: string): string {
  const title = report.formationTitle ?? report.courseTitle ?? "formation";
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `emargement-${slug}-${report.month}.${extension}`;
}
