"use client";

import { setClockOffset } from "./dates";

let pending: Promise<void> | null = null;

/**
 * Measures once the offset between the server clock and the device clock,
 * then every todayIso() / nowTime() call is corrected with it.
 * Silent on failure (offline): the device clock is used.
 */
export function syncServerClock(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const sentAt = Date.now();
      const res = await fetch("/api/time", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { now } = (await res.json()) as { now: number };
      const receivedAt = Date.now();
      // Server time is taken at the middle of the round trip.
      setClockOffset(now - (sentAt + receivedAt) / 2);
    } catch (err) {
      console.warn("syncServerClock: server clock unavailable, using device clock", err);
      pending = null;
    }
  })();
  return pending;
}
