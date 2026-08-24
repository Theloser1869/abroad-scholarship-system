/// Portal-context-aware notification navigation. F07's `notificationEventMeta` (`lib/
/// notifications/notification-event-map.ts`) points every event at its STAFF-shell route
/// (`/visas/:id`, `/applications/:id`, ...) — correct for the staff inbox, but wrong here: a
/// STUDENT_PARENT clicking a notification inside `/portal` should land back inside the
/// Portal shell, at the SAME studentId context they're already in, never the staff shell
/// (F08 instruction §25 "related resource navigation" read together with §6 "different user
/// experience"). Every event name below is the same real, grepped set F07 already
/// enumerated — nothing invented — only the destination differs. TASK_* events, which F07
/// could never link (no staff Task route exists anywhere in this app), DO resolve here: the
/// Portal has a real Task detail route F07's staff inbox does not.
export function portalNotificationHref(event: string, studentId: string, payload: Record<string, unknown>): string | null {
  const str = (key: string): string | null => {
    const value = payload[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  };
  const base = `/portal/students/${studentId}`;

  switch (event) {
    case "APPLICATION_SUBMITTED": {
      const id = str("applicationId");
      return id ? `${base}/applications/${id}` : null;
    }
    case "SCHOLARSHIP_AWARDED": {
      const id = str("scholarshipApplicationId");
      return id ? `${base}/scholarships/${id}` : null;
    }
    case "VISA_SUBMITTED":
    case "VISA_APPOINTMENT_SCHEDULED":
    case "VISA_RESULT": {
      const id = str("visaId");
      return id ? `${base}/visa/${id}` : null;
    }
    case "TASK_ASSIGNED":
    case "TASK_BLOCKED":
    case "TASK_DEADLINE_REMINDER":
    case "TASK_OVERDUE_REMINDER": {
      const id = str("taskId");
      return id ? `${base}/tasks/${id}` : null;
    }
    case "PAYMENT_OVERDUE_REMINDER": {
      const contractId = str("contractId");
      return contractId ? `${base}/contracts/${contractId}/payments` : null;
    }
    default:
      // CONTRACT_APPROVAL_REQUEST and any other staff-only event realistically never reach
      // a STUDENT_PARENT inbox (recipients are staff approvers) — no link fabricated for it.
      return null;
  }
}
