import {
  buildUsersExcel,
  usersExportFileName,
  type UsersExportPayload,
} from "@/lib/exports/usersExport";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { errorResponse, HttpError, requireRole } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const caller = await requireRole(request, ["admin", "pedagogical_lead"]);

    const rate = checkRateLimit(`export_users_xlsx_${caller.id}`, 25, 60_000);
    if (!rate.allowed) {
      throw new HttpError(429, "Trop de demandes d'export Excel. Veuillez patienter quelques instants.");
    }

    const body = (await request.json().catch(() => null)) as { payload?: UsersExportPayload } | null;
    const payload = body?.payload;
    if (!payload || !Array.isArray(payload.users)) {
      throw new HttpError(400, "Données d'utilisateurs invalides.");
    }

    const buffer = await buildUsersExcel(payload);
    return new Response(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${usersExportFileName(payload, "xlsx")}"`,
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
