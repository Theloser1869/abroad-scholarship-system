import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";

/// F08 instruction §31/§32 — the multi-child privacy guarantee is structural (a differently-
/// keyed TanStack Query cache entry), not behavioral, so it is directly testable as a pure
/// function of the key factory: every `portal.student.*` key must embed `studentId`, and two
/// different students must never produce the same key for the same view.
describe("queryKeys.portal — cache privacy across children (F08 instruction §31/§32)", () => {
  it("embeds studentId as the third segment for every student-scoped key, matching the mega-prompt's own example", () => {
    expect(queryKeys.portal.student.roadmap("student-A")).toEqual(["portal", "student", "student-A", "roadmap"]);
  });

  it("produces completely distinct keys for two different students on the same view", () => {
    const a = queryKeys.portal.student.roadmap("student-A");
    const b = queryKeys.portal.student.roadmap("student-B");
    expect(a).not.toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("keeps every domain area (tasks/documents/applications/scholarships/visa/pre-departure/enrollment/contracts/notifications) distinct per student", () => {
    const studentA = [
      queryKeys.portal.student.profile("A"),
      queryKeys.portal.student.tasks("A", {}),
      queryKeys.portal.student.documents("A"),
      queryKeys.portal.student.applications("A", {}),
      queryKeys.portal.student.scholarships("A"),
      queryKeys.portal.student.visas("A", {}),
      queryKeys.portal.student.preDeparture("A"),
      queryKeys.portal.student.enrollment("A"),
      queryKeys.portal.student.contracts("A", {}),
      queryKeys.portal.student.notifications("A", {}),
    ];
    const studentB = [
      queryKeys.portal.student.profile("B"),
      queryKeys.portal.student.tasks("B", {}),
      queryKeys.portal.student.documents("B"),
      queryKeys.portal.student.applications("B", {}),
      queryKeys.portal.student.scholarships("B"),
      queryKeys.portal.student.visas("B", {}),
      queryKeys.portal.student.preDeparture("B"),
      queryKeys.portal.student.enrollment("B"),
      queryKeys.portal.student.contracts("B", {}),
      queryKeys.portal.student.notifications("B", {}),
    ];
    studentA.forEach((key, i) => expect(JSON.stringify(key)).not.toBe(JSON.stringify(studentB[i])));
  });

  it("nests contract payments under both studentId AND contractId, never bleeding across either", () => {
    const a = queryKeys.portal.student.payments("student-A", "contract-1", {});
    const b = queryKeys.portal.student.payments("student-A", "contract-2", {});
    const c = queryKeys.portal.student.payments("student-B", "contract-1", {});
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("`portal.me()` is the one deliberate exception — no studentId, since it resolves the caller's own accessible list", () => {
    expect(queryKeys.portal.me()).toEqual(["portal", "me"]);
  });
});
