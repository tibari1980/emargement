import { describe, expect, it } from "vitest";
import { resolveAttendanceConflict } from "./conflictResolver";
import {
  countPendingAttendances,
  enqueuePendingAttendance,
  getPendingAttendances,
  removePendingAttendance,
} from "./db";
import type { PendingAttendanceRecord } from "./types";
import type { Attendance } from "@/lib/domain/types";

describe("Offline: Conflict Resolution Engine", () => {
  const basePending: PendingAttendanceRecord = {
    id: "slot1_trainee1_2026-11-03",
    slotId: "slot1",
    formationId: "form1",
    subjectId: "subj1",
    trainerId: "trainer1",
    traineeId: "trainee1",
    traineeFullName: "Stagiaire Test",
    date: "2026-11-03",
    month: "2026-11",
    status: "absent",
    arrivalTime: null,
    excuseReason: null,
    recordedBy: "trainer1",
    recordedByRole: "trainer",
    recordedByName: "Formateur Test",
    clientTimestamp: "2026-11-03T09:30:00.000Z",
    deviceSignature: "dev_test_123",
    sessionLabel: "Informatique Adaptée",
    slotStartTime: "09:00",
    slotEndTime: "10:20",
    syncStatus: "pending",
    attempts: 0,
  };

  it("accepts pending record when no prior server record exists", () => {
    const res = resolveAttendanceConflict(basePending, null);
    expect(res.shouldOverwrite).toBe(true);
    expect(res.finalStatus).toBe("absent");
  });

  it("preserves official administrative medical justification over offline absent mark", () => {
    const remoteExcused: Attendance = {
      id: "slot1_trainee1_2026-11-03",
      formationId: "form1",
      slotId: "slot1",
      subjectId: "subj1",
      trainerId: "trainer1",
      traineeId: "trainee1",
      date: "2026-11-03",
      month: "2026-11",
      status: "excused",
      arrivalTime: null,
      excuseReason: "Arrêt maladie",
      recordedBy: "sec1",
    };

    const res = resolveAttendanceConflict(basePending, remoteExcused);
    expect(res.shouldOverwrite).toBe(false);
    expect(res.finalStatus).toBe("excused");
    expect(res.finalExcuseReason).toBe("Arrêt maladie");
  });

  it("prioritizes physical presence observed in class over prior default absence", () => {
    const remoteAbsent: Attendance = {
      id: "slot1_trainee1_2026-11-03",
      formationId: "form1",
      slotId: "slot1",
      subjectId: "subj1",
      trainerId: "trainer1",
      traineeId: "trainee1",
      date: "2026-11-03",
      month: "2026-11",
      status: "absent",
      arrivalTime: null,
      excuseReason: null,
      recordedBy: "sec1",
    };

    const pendingPresent: PendingAttendanceRecord = {
      ...basePending,
      status: "present",
    };

    const res = resolveAttendanceConflict(pendingPresent, remoteAbsent);
    expect(res.shouldOverwrite).toBe(true);
    expect(res.finalStatus).toBe("present");
  });

  it("records precise late arrival when specified by trainer", () => {
    const remoteAbsent: Attendance = {
      id: "slot1_trainee1_2026-11-03",
      formationId: "form1",
      slotId: "slot1",
      subjectId: "subj1",
      trainerId: "trainer1",
      traineeId: "trainee1",
      date: "2026-11-03",
      month: "2026-11",
      status: "absent",
      arrivalTime: null,
      excuseReason: null,
      recordedBy: "sec1",
    };

    const pendingLate: PendingAttendanceRecord = {
      ...basePending,
      status: "late",
      arrivalTime: "09:25",
    };

    const res = resolveAttendanceConflict(pendingLate, remoteAbsent);
    expect(res.shouldOverwrite).toBe(true);
    expect(res.finalStatus).toBe("late");
    expect(res.finalArrivalTime).toBe("09:25");
  });
});

describe("Offline: Queue Storage & Fallback", () => {
  const sample: PendingAttendanceRecord = {
    id: "slotA_traineeB_2026-11-03",
    slotId: "slotA",
    formationId: "formA",
    subjectId: "subjA",
    trainerId: "trainerA",
    traineeId: "traineeB",
    traineeFullName: "Alice Dupont",
    date: "2026-11-03",
    month: "2026-11",
    status: "present",
    arrivalTime: null,
    excuseReason: null,
    recordedBy: "trainerA",
    recordedByRole: "trainer",
    recordedByName: "Formateur A",
    clientTimestamp: new Date().toISOString(),
    deviceSignature: "dev_sig_test",
    sessionLabel: "Braille",
    slotStartTime: "10:30",
    slotEndTime: "11:50",
    syncStatus: "pending",
    attempts: 0,
  };

  it("enqueues, retrieves and counts records correctly", async () => {
    await enqueuePendingAttendance(sample);
    const count = await countPendingAttendances();
    expect(count).toBeGreaterThanOrEqual(1);

    const list = await getPendingAttendances();
    const found = list.find((r) => r.id === sample.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe("present");

    await removePendingAttendance(sample.id);
    const afterDelete = await getPendingAttendances();
    expect(afterDelete.some((r) => r.id === sample.id)).toBe(false);
  });
});

