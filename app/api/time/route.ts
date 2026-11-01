import { connection } from "next/server";

/**
 * Reference clock of the application. The attendance screen compares it with
 * the device clock so that changing the computer's time cannot unlock a session.
 */
export async function GET() {
  await connection();
  return Response.json(
    { now: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
