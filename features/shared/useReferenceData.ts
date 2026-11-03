"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getInitialFormations, listFormations } from "@/lib/data/formations";
import { getInitialHolidays, listHolidays } from "@/lib/data/holidays";
import { getInitialSubjects, listSubjects } from "@/lib/data/subjects";
import { getInitialStaff, listStaff } from "@/lib/data/users";
import { frenchPublicHolidays } from "@/lib/domain/frenchHolidays";
import { closedDaySet } from "@/lib/domain/hoursCalculator";
import { SUBJECT_CATALOG } from "@/lib/domain/catalog";
import { DEMO_USERS } from "@/lib/data/users";
import { STAFF_ROLES, type Formation, type Holiday, type Subject, type UserProfile } from "@/lib/domain/types";

export interface ReferenceData {
  formations: Formation[];
  subjects: Subject[];
  /** Every staff member, deactivated ones included (history display). */
  staff: UserProfile[];
  holidays: Holiday[];
}

let cachedReferenceData: ReferenceData | null = null;
let lastFetchTime = 0;
let inFlightRefPromise: Promise<ReferenceData> | null = null;
const CACHE_TTL_MS = 60_000; // 60s cache for instant tab switching

export function getInitialReferenceData(): ReferenceData {
  if (cachedReferenceData) return cachedReferenceData;
  return {
    formations: getInitialFormations(),
    subjects: getInitialSubjects(),
    staff: getInitialStaff(STAFF_ROLES),
    holidays: getInitialHolidays(),
  };
}

async function fetchReferenceData(force = false): Promise<ReferenceData> {
  if (!force && cachedReferenceData && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return cachedReferenceData;
  }
  if (!force && inFlightRefPromise) {
    return inFlightRefPromise;
  }

  inFlightRefPromise = (async () => {
    const [formations, subjects, staff, holidays] = await Promise.all([
      listFormations(force).catch((err) => {
        console.warn("fetchReferenceData: listFormations failed", err);
        return getInitialFormations();
      }),
      listSubjects(force).catch((err) => {
        console.warn("fetchReferenceData: listSubjects failed", err);
        return getInitialSubjects();
      }),
      listStaff(STAFF_ROLES).catch((err) => {
        console.warn("fetchReferenceData: staff query failed", err);
        return getInitialStaff(STAFF_ROLES);
      }),
      listHolidays(force).catch((err) => {
        console.warn("fetchReferenceData: listHolidays failed", err);
        return getInitialHolidays();
      }),
    ]);
    const result = { formations, subjects, staff, holidays };
    cachedReferenceData = result;
    lastFetchTime = Date.now();
    return result;
  })().finally(() => {
    inFlightRefPromise = null;
  });

  return inFlightRefPromise;
}

/** Reference data shared by several screens, with name lookups. */
export function useReferenceData() {
  const [data, setData] = useState<ReferenceData>(() => getInitialReferenceData());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    fetchReferenceData()
      .then((res) => {
        if (!stale) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        console.warn("fetchReferenceData failed:", err);
        if (!stale) {
          setData((prev) => prev ?? { formations: [], subjects: [], staff: [], holidays: [] });
          setError(null);
        }
      });
    return () => {
      stale = true;
    };
  }, []);

  const reload = useCallback(async () => {
    const fresh = await fetchReferenceData(true);
    setData(fresh);
    return fresh;
  }, []);

  const lookups = useMemo(() => {
    if (!data) return null;
    const formation = new Map(data.formations.map((f) => [f.id, f]));
    const subject = new Map(data.subjects.map((s) => [s.id, s]));
    const person = new Map(data.staff.map((u) => [u.id, u]));

    const currentYear = new Date().getFullYear();
    const publicHolidays = [
      ...frenchPublicHolidays(currentYear - 1),
      ...frenchPublicHolidays(currentYear),
      ...frenchPublicHolidays(currentYear + 1),
    ];
    const publicHolidayMap = new Map(publicHolidays.map((h) => [h.date, h.title]));
    const closed = closedDaySet(data.holidays);
    for (const ph of publicHolidays) closed.add(ph.date);

    return {
      formation: (id: string) => formation.get(id),
      formationTitle: (id: string) => formation.get(id)?.title ?? "Formation inconnue",
      subjectTitle: (id: string) =>
        id === "default_subject" || id === "general"
          ? "Enseignement général & Travaux pratiques"
          : (subject.get(id)?.title ?? "Matière inconnue"),
      personName: (id: string) => person.get(id)?.fullName ?? "Équipe pédagogique",
      trainerName: (id: string) => {
        const p = person.get(id);
        if (!p || p.role === "admin" || p.role === "secretary") return "Équipe pédagogique";
        return p.fullName;
      },
      closedDays: closed,
      closureTitle: (iso: string): string | null => {
        const custom = data.holidays.find((h) => h.startDate <= iso && iso <= h.endDate);
        if (custom) return custom.title;
        return publicHolidayMap.get(iso) ?? null;
      },
    };
  }, [data]);

  return { data, lookups, error, reload };
}
