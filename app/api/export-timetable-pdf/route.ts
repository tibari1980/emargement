import {
  buildTimetablePdf,
  timetableExportFileName,
  type TimetableExportPayload,
} from "@/lib/exports/timetableExport";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { errorResponse, HttpError, requireRole } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const caller = await requireRole(request, ["admin", "pedagogical_lead", "secretary", "trainer"]);

    const rate = checkRateLimit(`export_tt_pdf_${caller.id}`, 25, 60_000);
    if (!rate.allowed) {
      throw new HttpError(429, "Trop de demandes d'export PDF. Veuillez patienter quelques instants.");
    }

    const body = (await request.json().catch(() => null)) as { payload?: TimetableExportPayload } | null;
    const payload = body?.payload;
    if (!payload || !payload.targetTitle || !Array.isArray(payload.slots)) {
      throw new HttpError(400, "Données d'emploi du temps invalides.");
    }

    // Règle stricte de confidentialité Formateur : un formateur ne peut exporter que son propre planning individuel
    if (caller.role === "trainer" && payload.mode === "trainer" && payload.targetId !== caller.id) {
      throw new HttpError(403, "Un formateur ne peut télécharger que son propre planning individuel.");
    }

    const pdf = await buildTimetablePdf(payload);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${timetableExportFileName(payload, "pdf")}"`,
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
