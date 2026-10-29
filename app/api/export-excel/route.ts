import { buildExcelReport } from "@/lib/exports/excel";
import { errorResponse, requireRole } from "@/lib/server/auth";
import { exportFileName, readReport } from "@/lib/server/reportData";

// POST { report } (computed by the browser) → monthly attendance workbook (.xlsx).
export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "pedagogical_lead"]);
    const report = await readReport(request);
    const workbook = await buildExcelReport(report);
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFileName(report, "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
