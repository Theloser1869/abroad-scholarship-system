import { describe, expect, it } from "vitest";
import { portalNotificationHref } from "./notification-links";

describe("portalNotificationHref — Portal-context navigation, distinct from F07's staff-route event map", () => {
  it("routes VISA_RESULT back into the Portal shell at the current student, not the staff /visas/:id route", () => {
    expect(portalNotificationHref("VISA_RESULT", "student-A", { visaId: "visa-1" })).toBe("/portal/students/student-A/visa/visa-1");
  });

  it("resolves TASK_ASSIGNED to a real Portal Task detail route — unlike the staff inbox, which can never link it (no staff Task route exists)", () => {
    expect(portalNotificationHref("TASK_ASSIGNED", "student-A", { taskId: "task-1" })).toBe("/portal/students/student-A/tasks/task-1");
  });

  it("returns null (never a fabricated URL) when the payload lacks the needed id", () => {
    expect(portalNotificationHref("VISA_RESULT", "student-A", {})).toBeNull();
  });

  it("returns null for a staff-only event that would never realistically reach a STUDENT_PARENT inbox", () => {
    expect(portalNotificationHref("CONTRACT_APPROVAL_REQUEST", "student-A", { contractId: "c1" })).toBeNull();
  });
});
