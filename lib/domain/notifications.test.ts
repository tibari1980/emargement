import { describe, expect, it } from "vitest";
import {
  filterNotificationsForUser,
  getUnreadCount,
} from "../data/notifications";
import type { AppNotification } from "./types";

describe("Notifications Domain Logic", () => {
  const sampleNotifications: AppNotification[] = [
    {
      id: "n-1",
      targetRole: "trainer",
      title: "Rappel formateur",
      message: "Séance en cours",
      type: "urgent",
      read: false,
      createdAt: "2026-10-31T09:00:00Z",
    },
    {
      id: "n-2",
      targetRole: "secretary",
      title: "Formateur absent",
      message: "Suppléance requise",
      type: "warning",
      read: false,
      createdAt: "2026-10-31T09:30:00Z",
    },
    {
      id: "n-3",
      userId: "user-123",
      title: "Message personnel",
      message: "Votre compte a été mis à jour",
      type: "info",
      read: true,
      createdAt: "2026-10-31T10:00:00Z",
    },
    {
      id: "n-4",
      title: "Message général broadcast",
      message: "Fermeture exceptionnelle demain",
      type: "info",
      read: false,
      createdAt: "2026-10-31T08:00:00Z",
    },
  ];

  it("filters notifications specifically targeted to a role and broadcast", () => {
    const trainerUser = { id: "trainer-1", role: "trainer" as const };
    const trainerNotifs = filterNotificationsForUser(sampleNotifications, trainerUser);

    expect(trainerNotifs.map((n) => n.id)).toEqual(["n-1", "n-4"]);
  });

  it("filters notifications targeted specifically to user ID", () => {
    const targetUser = { id: "user-123", role: "trainer" as const };
    const userNotifs = filterNotificationsForUser(sampleNotifications, targetUser);

    // Should include user-specific (n-3), role (n-1), and broadcast (n-4)
    expect(userNotifs.map((n) => n.id)).toContain("n-3");
    expect(userNotifs.map((n) => n.id)).toContain("n-1");
    expect(userNotifs.map((n) => n.id)).toContain("n-4");
    expect(userNotifs.map((n) => n.id)).not.toContain("n-2");
  });

  it("calculates unread count correctly", () => {
    const unread = getUnreadCount(sampleNotifications);
    expect(unread).toBe(3); // n-1, n-2, n-4 are unread
  });

  it("sorts notifications by creation date descending", () => {
    const user = { id: "user-123", role: "trainer" as const };
    const notifs = filterNotificationsForUser(sampleNotifications, user);

    // Check chronological order (newest first)
    for (let i = 0; i < notifs.length - 1; i++) {
      const current = new Date(notifs[i].createdAt).getTime();
      const next = new Date(notifs[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });
});
