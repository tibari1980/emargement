"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDb } from "@/lib/core/firebase";
import { byName, COLLECTIONS, withId } from "@/lib/data/db";
import { listFormations } from "@/lib/data/formations";
import { listHolidays } from "@/lib/data/holidays";
import { listSubjects } from "@/lib/data/subjects";
import { closedDaySet } from "@/lib/domain/hoursCalculator";
import { STAFF_ROLES, type Formation, type Holiday, type Subject, type UserProfile } from "@/lib/domain/types";

export interface ReferenceData {
  formations: Formation[];
  subjects: Subject[];
  /** Every staff member, deactivated ones included (history display). */
  staff: UserProfile[];
  holidays: Holiday[];
}

async function fetchReferenceData(): Promise<ReferenceData> {
  const [formations, subjects, staffSnap, holidays] = await Promise.all([
    listFormations(),
    listSubjects(),
    getDocs(query(collection(getDb(), COLLECTIONS.users), where("role", "in", STAFF_ROLES))),
    listHolidays(),
  ]);
  const staff = staffSnap.docs.map((d) => withId<UserProfile>(d)).sort(byName);
  return { formations, subjects, staff, holidays };
}

/** Reference data shared by several screens, with name lookups. */
export function useReferenceData() {
  const [data, setData] = useState<ReferenceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReferenceData()
      .then(setData)
      .catch(() => setError("Impossible de charger les données de référence."));
  }, []);

  const reload = useCallback(async () => setData(await fetchReferenceData()), []);

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
      closedDays: closedDaySet(data.holidays),
    };
  }, [data]);

  return { data, lookups, error, reload };
}
