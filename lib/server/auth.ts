import "server-only";

import type { Role } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/**
 * Checks the Firebase ID token sent as "Authorization: Bearer <token>" and
 * that the caller's profile (users/{uid}) holds one of the given roles.
 * Uses the Firebase REST APIs with the caller's own token: no service
 * account is needed, and Firestore security rules still apply.
 */
export async function requireRole(request: Request, roles: Role[]): Promise<{ id: string; role: Role }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Authentification requise.");

  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    cache: "no-store",
  });
  const uid = lookup.ok
    ? ((await lookup.json()) as { users?: { localId: string }[] }).users?.[0]?.localId
    : undefined;
  if (!uid) throw new HttpError(401, "Session expirée ou invalide.");

  const profile = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const role = profile.ok
    ? ((await profile.json()) as { fields?: { role?: { stringValue?: string } } }).fields?.role?.stringValue
    : undefined;
  if (!role || !roles.includes(role as Role)) {
    throw new HttpError(403, "Accès refusé pour ce rôle.");
  }
  return { id: uid, role: role as Role };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Erreur interne du serveur." }, { status: 500 });
}
