// Domain model of the CFRP Valentin Haüy attendance application.
//
//   Formation ──< TimetableSlot >── Subject (matière)
//                     │    └──────── Trainer (user)
//                     └──< Attendance >── Trainee (user)
//
// A formation has a weekly timetable made of slots; each slot is a subject
// taught by a trainer. Attendance is recorded per session (slot × date).

/* ------------------------------------------------------------------ roles */

export const ROLES = ["admin", "secretary", "pedagogical_lead", "trainer", "trainee"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  secretary: "Secrétariat",
  pedagogical_lead: "Responsable pédagogique",
  trainer: "Formateur",
  trainee: "Stagiaire",
};

/** Roles that sign in to the application (trainees are records only). */
export const STAFF_ROLES: Role[] = ["admin", "secretary", "pedagogical_lead", "trainer"];

/* ------------------------------------------------------- audited documents */

/** Every document written by the application references its last audit entry. */
export interface Audited {
  lastAuditId?: string;
}

export interface UserProfile extends Audited {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  phone?: string;
  room?: string;
  specialty?: string;
  /** Deactivated accounts keep their history but lose every access. */
  active?: boolean;
  createdAt?: unknown;
}

export const FORMATION_CATEGORIES = ["professional", "preparatory", "module"] as const;
export type FormationCategory = (typeof FORMATION_CATEGORIES)[number];

export const FORMATION_CATEGORY_LABELS: Record<FormationCategory, string> = {
  professional: "Formation professionnelle",
  preparatory: "Formation préparatoire et mise à niveau",
  module: "Module spécifique",
};

export interface Formation extends Audited {
  id: string;
  title: string;
  category: FormationCategory;
  description: string;
  /** Free text, e.g. "10,5 mois — 1 400 heures". */
  duration: string;
  certification: string;
  pedagogicalLeadId: string;
  traineeIds: string[];
  active: boolean;
  /** Year level of this cohort (1 for 1ère année, 2 for 2ème année, etc., or null for single-year). */
  yearLevel?: number | null;
  /** Total duration in years of the curriculum (e.g. 1, 2, 4, 5). */
  totalYears?: number | null;
  /** Short acronym or code for display (e.g. "TIP 1", "TIP 2", "K1", "PREPA-INFO"). */
  shortCode?: string;
  /** Academic promotion year, e.g. "2025-2026", "2026-2027". */
  academicYear?: string;
}

/** A subject (matière), shared by every formation that teaches it. */
export interface Subject extends Audited {
  id: string;
  title: string;
  description: string;
  /** Trainers qualified to teach the subject (empty: any trainer). */
  trainerIds: string[];
  active: boolean;
}

export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
};

/** One recurring session of the weekly timetable of a formation. */
export interface TimetableSlot extends Audited {
  id: string;
  formationId: string;
  subjectId: string;
  trainerId: string;
  weekday: Weekday;
  startTime: string; // "09:00"
  endTime: string; // "10:20"
  room: string;
  /** First day the slot applies ("YYYY-MM-DD"). */
  validFrom: string;
  /** Last day the slot applies, or null when open-ended. */
  validTo: string | null;
}

export type HolidayType = "holiday" | "vacation";

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  holiday: "Jour férié",
  vacation: "Vacances / fermeture",
};

export interface Holiday extends Audited {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: HolidayType;
}

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Absence justifiée",
};

/** Attendance of one trainee at one session (slot × date). */
export interface Attendance extends Audited {
  id: string;
  formationId: string;
  slotId: string;
  subjectId: string;
  trainerId: string;
  traineeId: string;
  date: string; // "YYYY-MM-DD"
  /** "YYYY-MM", derived from date: monthly queries need no composite index. */
  month: string;
  status: AttendanceStatus;
  arrivalTime: string | null;
  excuseReason: string | null;
  recordedBy: string;
  updatedAt?: unknown;
}

/** Deterministic id: one record per trainee and session. */
export function attendanceId(slotId: string, traineeId: string, date: string): string {
  return `${slotId}_${traineeId}_${date}`;
}

/* ------------------------------------------------------------ audit trail */

export const AUDIT_ENTITY_TYPES = [
  "user",
  "formation",
  "subject",
  "timetableSlot",
  "holiday",
  "attendance",
  "application",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  user: "Utilisateurs",
  formation: "Formations",
  subject: "Matières",
  timetableSlot: "Emploi du temps",
  holiday: "Calendrier",
  attendance: "Émargement",
  application: "Application",
};

export interface AuditChange {
  from: unknown;
  to: unknown;
}

/** Immutable journal entry: who did what, when. */
export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  /** Machine-readable action, e.g. "attendance.record". */
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  /** Human-readable sentence shown in the journal. */
  summary: string;
  changes: Record<string, AuditChange> | null;
  at?: { toDate(): Date } | null;
  /** "YYYY-MM-DD" (local), used to query a period without composite index. */
  day: string;
}
