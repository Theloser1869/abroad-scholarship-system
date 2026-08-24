"use client";

import { useRouter } from "next/navigation";
import { usePortalMe } from "@/lib/portal/hooks";

/// The linked-child list ALWAYS comes from `GET /portal/me` — never inferred from
/// email/name/URL (F08 instruction §10: "Do not infer relationship from email/name").
/// Rendered only when there is something to switch between; a lone Student-self or
/// single-child Parent never sees this control at all. Switching always lands on the new
/// student's Overview page, never a deep sub-page carried over from the old context — a
/// child-specific detail id (an applicationId, a taskId, ...) has no meaning for a
/// different student and would either 404 or, worse, look like it silently loaded (F08
/// instruction §32: never render stale/mismatched child content during a switch).
export function StudentSwitcher({ currentStudentId }: { currentStudentId: string }) {
  const router = useRouter();
  const { data } = usePortalMe(true);
  const students = data?.students ?? [];

  if (students.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Học sinh:</span>
      <select
        aria-label="Chuyển đổi học sinh"
        value={currentStudentId}
        onChange={(e) => router.push(`/portal/students/${e.target.value}`)}
        className="rounded border border-border bg-background px-2 py-1 text-sm"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.fullName} {s.relationship !== "SELF" ? `(${s.relationship})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
