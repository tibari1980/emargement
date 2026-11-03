import { z } from "zod";
import { ATTENDANCE_STATUSES, FORMATION_CATEGORIES } from "./types";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const IsoDateSchema = z.string().regex(isoDateRegex, "Format de date invalide (AAAA-MM-JJ)");
export const TimeSchema = z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)");
export const MonthSchema = z.string().regex(monthRegex, "Format de mois invalide (AAAA-MM)");

export const AttendanceEntrySchema = z.object({
  trainee: z.object({
    id: z.string().min(1, "Identifiant stagiaire manquant"),
    fullName: z.string().min(1, "Nom stagiaire manquant"),
  }),
  status: z.enum(ATTENDANCE_STATUSES),
  arrivalTime: z.string().regex(timeRegex).nullable().optional(),
  excuseReason: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const SlotInputSchema = z
  .object({
    formationId: z.string().min(1, "La formation est obligatoire"),
    subjectId: z.string().min(1, "La matière est obligatoire"),
    trainerId: z.string().min(1, "Le formateur est obligatoire"),
    weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    startTime: TimeSchema,
    endTime: TimeSchema,
    room: z.string().default(""),
    validFrom: IsoDateSchema,
    validTo: IsoDateSchema.nullable(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "L'heure de fin doit être postérieure à l'heure de début",
    path: ["endTime"],
  })
  .refine((data) => !data.validTo || data.validTo >= data.validFrom, {
    message: "La date de fin doit être postérieure à la date de début",
    path: ["validTo"],
  });

export const FormationInputSchema = z.object({
  title: z.string().min(2, "Le titre doit contenir au moins 2 caractères"),
  category: z.enum(FORMATION_CATEGORIES),
  description: z.string().default(""),
  duration: z.string().default(""),
  certification: z.string().default(""),
  pedagogicalLeadId: z.string().default(""),
  traineeIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const HolidayInputSchema = z
  .object({
    title: z.string().min(2, "L'intitulé est obligatoire"),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    type: z.enum(["holiday", "vacation"]),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "La date de fin doit être postérieure à la date de début",
    path: ["endDate"],
  });

export const MonthlyReportPayloadSchema = z.object({
  report: z.object({
    month: MonthSchema,
    formationId: z.string().optional(),
    formationTitle: z.string().optional(),
    courseTitle: z.string().optional(),
    theoreticalHours: z.number().nonnegative(),
    workingDays: z.array(z.string()),
    closedDays: z.array(z.string()),
    totals: z.object({
      theoreticalHours: z.number(),
      absentHours: z.number(),
      excusedHours: z.number(),
      lateMinutes: z.number(),
      totalAbsenceHours: z.number(),
      effectivePresenceHours: z.number(),
    }),
    trainees: z.array(
      z.object({
        fullName: z.string(),
        theoreticalHours: z.number(),
        effectivePresenceHours: z.number(),
        totalAbsenceHours: z.number(),
        lateMinutes: z.number(),
      }).passthrough()
    ),
  }).passthrough(),
});
