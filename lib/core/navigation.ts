import { can, type Permission } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/types";

export type ModuleCategory = "trainer" | "pedagogical" | "secretary" | "admin" | "shared";

export interface NavItem {
  href: string;
  label: string;
  permission: Permission;
  category?: ModuleCategory;
}

/** Dedicated attendance URL for each profile role to prevent cross-profile conflicts. */
export function emargementHrefFor(role: Role): string {
  if (role === "secretary") return "/secretary/emargement";
  if (role === "pedagogical_lead" || role === "admin") return "/pedagogical/emargement";
  return "/trainer/emargement";
}

export function emargementCategoryFor(role: Role): ModuleCategory {
  if (role === "secretary") return "secretary";
  if (role === "pedagogical_lead" || role === "admin") return "pedagogical";
  return "trainer";
}

/** Main menu, in display order. Each entry is shown to roles holding its permission. */
export const NAV_ITEMS: NavItem[] = [
  // Module Administration (Cockpit principal)
  { href: "/admin", label: "Centre de contrôle", permission: "audit.read", category: "admin" },
  { href: "/admin/users", label: "Utilisateurs", permission: "users.manage", category: "admin" },
  { href: "/admin/audit", label: "Journal d'activité", permission: "audit.read", category: "admin" },

  // Module Émargement (URL isolée par profil via navFor)
  { href: "/trainer/emargement", label: "Émargement", permission: "attendance.record", category: "trainer" },
  { href: "/planning", label: "Plannings", permission: "planning.view", category: "shared" },

  // Module Responsable Pédagogique
  { href: "/pedagogical/reports", label: "Rapports mensuels", permission: "reports.view", category: "pedagogical" },
  { href: "/pedagogical/courses", label: "Formations", permission: "formations.manage", category: "pedagogical" },
  { href: "/pedagogical/subjects", label: "Matières", permission: "subjects.manage", category: "pedagogical" },
  { href: "/pedagogical/timetable", label: "Emplois du temps", permission: "timetable.manage", category: "pedagogical" },

  // Module Secrétariat
  { href: "/secretary/justifications", label: "Justificatifs", permission: "absences.justify", category: "secretary" },
  { href: "/secretary/import", label: "Import de stagiaires", permission: "trainees.import", category: "secretary" },
  { href: "/secretary/calendar", label: "Calendrier", permission: "calendar.manage", category: "secretary" },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.permission)).map((item) => {
    if (item.permission === "attendance.record") {
      return {
        ...item,
        href: emargementHrefFor(role),
        category: emargementCategoryFor(role),
      };
    }
    return item;
  });
}

/** First page of each role once signed in. */
export function homeFor(role: Role): string {
  if (role === "trainer") return "/trainer/emargement";
  if (role === "pedagogical_lead") return "/pedagogical/courses";
  if (role === "secretary") return "/secretary/justifications";
  if (role === "admin") return "/admin";
  return navFor(role)[0]?.href ?? "/acces-refuse";
}
