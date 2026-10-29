import type { Role } from "./types";

/**
 * Who may do what. This is the single place to change when a role is added
 * or its scope evolves (screens, menus and guards all read it).
 * Data access is enforced independently by firestore.rules: keep both in sync.
 */
export const PERMISSIONS = {
  "attendance.record": ["admin", "pedagogical_lead", "trainer"],
  /** Record attendance for any session, not only one's own. */
  "attendance.recordAny": ["admin", "pedagogical_lead"],
  "planning.view": ["admin", "pedagogical_lead", "trainer", "secretary"],
  "absences.justify": ["admin", "secretary"],
  "trainees.import": ["admin", "secretary"],
  "calendar.manage": ["admin", "secretary"],
  "formations.manage": ["admin", "pedagogical_lead"],
  "subjects.manage": ["admin", "pedagogical_lead"],
  "timetable.manage": ["admin", "pedagogical_lead"],
  "reports.view": ["admin", "pedagogical_lead"],
  "users.manage": ["admin"],
  "audit.read": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
