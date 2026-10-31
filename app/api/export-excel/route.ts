import { buildExcelReport } from "@/lib/exports/excel";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { errorResponse, HttpError, requireRole } from "@/lib/server/auth";
import { exportFileName, readReport } from "@/lib/server/reportData";

// POST { report } (computed by the browser) → monthly attendance workbook (.xlsx).
export async function POST(request: Request) {
  try {
    const caller = await requireRole(request, ["admin", "pedagogical_lead"]);

    // Anti-scraping rate limiter: max 20 exports per 60 seconds per user
    const rate = checkRateLimit(`export_excel_${caller.id}`, 20, 60_000);
    if (!rate.allowed) {
      throw new HttpError(429, "Trop de demandes d'export. Veuillez patienter avant de renouveler l'opération.");
    }

    const report = await readReport(request);
    const workbook = await buildExcelReport(report);
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFileName(report, "xlsx")}"`,
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
