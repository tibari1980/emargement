import { buildPdfReport } from "@/lib/exports/pdf";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { errorResponse, HttpError, requireRole } from "@/lib/server/auth";
import { exportFileName, readReport } from "@/lib/server/reportData";

// POST { report } (computed by the browser) → monthly attendance statement (PDF).
export async function POST(request: Request) {
  try {
    const caller = await requireRole(request, ["admin", "pedagogical_lead", "secretary"]);

    // Anti-scraping rate limiter: max 20 PDF exports per 60 seconds per user
    const rate = checkRateLimit(`export_pdf_${caller.id}`, 20, 60_000);
    if (!rate.allowed) {
      throw new HttpError(429, "Trop de demandes d'export PDF. Veuillez patienter avant de renouveler l'opération.");
    }

    const report = await readReport(request);
    const pdf = await buildPdfReport(report);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFileName(report, "pdf")}"`,
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
