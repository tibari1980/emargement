import {
  buildUsersPdf,
  usersExportFileName,
  type UsersExportPayload,
} from "@/lib/exports/usersExport";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { errorResponse, HttpError, requireRole } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const caller = await requireRole(request, ["admin", "pedagogical_lead"]);

    const rate = checkRateLimit(`export_users_pdf_${caller.id}`, 25, 60_000);
    if (!rate.allowed) {
      throw new HttpError(429, "Trop de demandes d'export PDF. Veuillez patienter quelques instants.");
    }

    const body = (await request.json().catch(() => null)) as { payload?: UsersExportPayload } | null;
    const payload = body?.payload;
    if (!payload || !Array.isArray(payload.users)) {
      throw new HttpError(400, "Données d'utilisateurs invalides.");
    }

    const pdf = await buildUsersPdf(payload);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${usersExportFileName(payload, "pdf")}"`,
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
