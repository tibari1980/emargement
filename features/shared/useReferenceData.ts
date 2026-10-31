"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/core/firebase";
import { byName, COLLECTIONS, withId } from "@/lib/data/db";
import { listFormations } from "@/lib/data/formations";
import { listHolidays } from "@/lib/data/holidays";
import { listSubjects } from "@/lib/data/subjects";
import { listStaff } from "@/lib/data/users";
import { closedDaySet } from "@/lib/domain/hoursCalculator";
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
const CACHE_TTL_MS = 30_000; // 30s cache for lightning-fast tab switching

async function fetchReferenceData(force = false): Promise<ReferenceData> {
  if (!force && cachedReferenceData && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return cachedReferenceData;
  }

  const [formations, subjects, staff, holidays] = await Promise.all([
    listFormations().catch((err) => {
      console.warn("fetchReferenceData: listFormations failed", err);
      return [] as Formation[];
    }),
    listSubjects().catch((err) => {
      console.warn("fetchReferenceData: listSubjects failed", err);
      return [] as Subject[];
    }),
    listStaff(STAFF_ROLES).catch((err) => {
      console.warn("fetchReferenceData: staff query failed", err);
      return [] as UserProfile[];
    }),
    listHolidays().catch((err) => {
      console.warn("fetchReferenceData: listHolidays failed", err);
      return [] as Holiday[];
    }),
  ]);
  const result = { formations, subjects, staff, holidays };
  cachedReferenceData = result;
  lastFetchTime = Date.now();
  return result;
}

/** Reference data shared by several screens, with name lookups. */
export function useReferenceData() {
  const [data, setData] = useState<ReferenceData | null>(cachedReferenceData);
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
    return {
      formation: (id: string) => formation.get(id),
      formationTitle: (id: string) => formation.get(id)?.title ?? "Formation inconnue",
      subjectTitle: (id: string) => subject.get(id)?.title ?? "Matière inconnue",
      personName: (id: string) => person.get(id)?.fullName ?? "Non attribué",
      trainerName: (id: string) => {
        const p = person.get(id);
        if (!p || p.role === "admin" || p.role === "secretary") return "Formateur non attribué";
        return p.fullName;
      },
      closedDays: closedDaySet(data.holidays),
    };
  }, [data]);

  return { data, lookups, error, reload };
}
