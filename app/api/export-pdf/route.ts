import { buildPdfReport } from "@/lib/exports/pdf";
import { errorResponse, requireRole } from "@/lib/server/auth";
import { exportFileName, readReport } from "@/lib/server/reportData";

// POST { report } (computed by the browser) → monthly attendance statement (PDF).
export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "pedagogical_lead"]);
    const report = await readReport(request);
    const pdf = await buildPdfReport(report);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFileName(report, "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
