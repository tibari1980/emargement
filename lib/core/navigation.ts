import { can, type Permission } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/types";

export interface NavItem {
  href: string;
  label: string;
  permission: Permission;
}

/** Main menu, in display order. Each entry is shown to roles holding its permission. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/trainer/emargement", label: "Émargement", permission: "attendance.record" },
  { href: "/planning", label: "Plannings", permission: "planning.view" },
  { href: "/pedagogical/reports", label: "Rapports mensuels", permission: "reports.view" },
  { href: "/pedagogical/courses", label: "Formations", permission: "formations.manage" },
  { href: "/pedagogical/subjects", label: "Matières", permission: "subjects.manage" },
  { href: "/pedagogical/timetable", label: "Emplois du temps", permission: "timetable.manage" },
  { href: "/admin/import", label: "Import de stagiaires", permission: "trainees.import" },
  { href: "/admin/justifications", label: "Justificatifs", permission: "absences.justify" },
  { href: "/admin/calendar", label: "Calendrier", permission: "calendar.manage" },
  { href: "/admin/users", label: "Utilisateurs", permission: "users.manage" },
  { href: "/admin/audit", label: "Journal d'activité", permission: "audit.read" },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.permission));
}

/** First page of each role once signed in. */
export function homeFor(role: Role): string {
  return navFor(role)[0]?.href ?? "/acces-refuse";
}
