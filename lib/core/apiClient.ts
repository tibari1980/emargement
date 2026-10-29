import { getFirebaseAuth } from "./firebase";

/** fetch() towards our API routes with the Firebase ID token attached. */
export async function authFetch(url: string, body: unknown, method = "POST"): Promise<Response> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Vous n'êtes plus connecté.");
  const token = await user.getIdToken();
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Erreur ${response.status}`);
  }
  return response;
}

/** Saves a Blob through a temporary link (works in every browser). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileNameFromResponse(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback;
}
