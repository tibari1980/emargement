import "server-only";

import { isValidMonth } from "@/lib/dates";
import type { MonthlyReport } from "@/lib/hoursCalculator";
import { HttpError } from "./auth";

const isNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/**
 * Reads the monthly report computed by the browser (lib/hoursCalculator.ts,
 * from data the user is allowed to read) and checks its shape before export.
 */
export async function readReport(request: Request): Promise<MonthlyReport> {
  const body = (await request.json().catch(() => null)) as { report?: MonthlyReport } | null;
  const r = body?.report;
  const valid =
    r &&
    typeof r.courseTitle === "string" &&
    typeof r.month === "string" &&
    isValidMonth(r.month) &&
    isNumber(r.dailyHours) &&
    isNumber(r.theoreticalHours) &&
    Array.isArray(r.workingDays) &&
    Array.isArray(r.closedDays) &&
    r.totals &&
    Array.isArray(r.trainees) &&
    r.trainees.length <= 1000 &&
    r.trainees.every(
      (t) =>
        typeof t.fullName === "string" &&
        isNumber(t.effectivePresenceHours) &&
        isNumber(t.totalAbsenceHours) &&
        isNumber(t.lateMinutes),
    );
  if (!valid) throw new HttpError(400, "Rapport invalide.");
  return r;
}

export function exportFileName(report: MonthlyReport, extension: string): string {
  const slug = report.courseTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `emargement-${slug}-${report.month}.${extension}`;
}
