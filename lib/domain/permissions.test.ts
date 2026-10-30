import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "./permissions";

describe("permissions: Role-Based Access Control", () => {
  it("grants admin full access to every permission", () => {
    const allPermissions = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];
    for (const perm of allPermissions) {
      expect(can("admin", perm)).toBe(true);
    }
  });

  it("restricts secretary to secretary actions", () => {
    expect(can("secretary", "absences.justify")).toBe(true);
    expect(can("secretary", "trainees.import")).toBe(true);
    expect(can("secretary", "calendar.manage")).toBe(true);
    expect(can("secretary", "planning.view")).toBe(true);

    // Forbidden for secretary
    expect(can("secretary", "users.manage")).toBe(false);
    expect(can("secretary", "audit.read")).toBe(false);
    expect(can("secretary", "formations.manage")).toBe(false);
    expect(can("secretary", "timetable.manage")).toBe(false);
  });

  it("restricts trainer to trainer actions", () => {
    expect(can("trainer", "attendance.record")).toBe(true);
    expect(can("trainer", "planning.view")).toBe(true);

    // Forbidden for trainer
    expect(can("trainer", "attendance.recordAny")).toBe(false);
    expect(can("trainer", "users.manage")).toBe(false);
    expect(can("trainer", "reports.view")).toBe(false);
    expect(can("trainer", "formations.manage")).toBe(false);
    expect(can("trainer", "calendar.manage")).toBe(false);
  });

  it("restricts pedagogical_lead appropriately", () => {
    expect(can("pedagogical_lead", "formations.manage")).toBe(true);
    expect(can("pedagogical_lead", "subjects.manage")).toBe(true);
    expect(can("pedagogical_lead", "timetable.manage")).toBe(true);
    expect(can("pedagogical_lead", "reports.view")).toBe(true);
    expect(can("pedagogical_lead", "attendance.record")).toBe(true);
    expect(can("pedagogical_lead", "attendance.recordAny")).toBe(true);

    // Forbidden for pedagogical_lead
    expect(can("pedagogical_lead", "users.manage")).toBe(false);
    expect(can("pedagogical_lead", "audit.read")).toBe(false);
    expect(can("pedagogical_lead", "calendar.manage")).toBe(false);
  });

  it("denies access when role is undefined or trainee", () => {
    expect(can(undefined, "attendance.record")).toBe(false);
    expect(can(null, "planning.view")).toBe(false);
    expect(can("trainee", "attendance.record")).toBe(false);
    expect(can("trainee", "users.manage")).toBe(false);
  });
});
