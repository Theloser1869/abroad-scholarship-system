/// `event` → {label, icon, navigation}. Every entry here is a REAL event name grepped from
/// every `notifications.notify(BothChannels)(...)` call site across the backend (F07
/// instruction §18: "Không invent type names") — there is no backend enum/list endpoint for
/// notification types, so this is transcribed directly from source, not guessed:
///   - `applications.service.ts` → APPLICATION_SUBMITTED
///   - `scholarship-applications.service.ts` → SCHOLARSHIP_AWARDED
///   - `contracts.service.ts` → CONTRACT_APPROVAL_REQUEST
///   - `payments.service.ts` → PAYMENT_OVERDUE_REMINDER
///   - `tasks.service.ts` → TASK_ASSIGNED / TASK_BLOCKED / TASK_DEADLINE_REMINDER / TASK_OVERDUE_REMINDER
///   - `visas.service.ts` → VISA_SUBMITTED / VISA_APPOINTMENT_SCHEDULED / VISA_RESULT
///
/// `buildHref` only returns a URL when BOTH the payload carries the needed id AND a real
/// frontend route exists for it — TASK_* events have no `buildHref` because there is no
/// staff Task detail route anywhere in this app yet (Task management was never built as a
/// standalone frontend surface through F06), not because the payload is insufficient. Per F07
/// instruction §18 ("nếu backend payload không đủ để build navigation... không tự đoán URL"),
/// the same rule is applied here even though the real gap is a missing route, not a missing
/// field — either way, this never fabricates a link to a page that doesn't exist.
export interface NotificationEventMeta {
  icon: string;
  label: string;
  buildHref?: (payload: Record<string, unknown>) => string | null;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const NOTIFICATION_EVENT_META: Record<string, NotificationEventMeta> = {
  APPLICATION_SUBMITTED: {
    icon: "📄",
    label: "Hồ sơ ứng tuyển đã nộp",
    buildHref: (p) => {
      const id = str(p, "applicationId");
      return id ? `/applications/${id}` : null;
    },
  },
  SCHOLARSHIP_AWARDED: {
    icon: "🎓",
    label: "Học bổng đã được trao",
    buildHref: (p) => {
      const id = str(p, "scholarshipApplicationId");
      return id ? `/scholarship-applications/${id}` : null;
    },
  },
  CONTRACT_APPROVAL_REQUEST: {
    icon: "📝",
    label: "Yêu cầu duyệt hợp đồng",
    buildHref: (p) => {
      const id = str(p, "contractId");
      return id ? `/contracts/${id}` : null;
    },
  },
  PAYMENT_OVERDUE_REMINDER: {
    icon: "💰",
    label: "Nhắc thanh toán quá hạn",
    buildHref: (p) => {
      const id = str(p, "contractId");
      return id ? `/contracts/${id}/payments` : null;
    },
  },
  TASK_ASSIGNED: { icon: "✅", label: "Nhiệm vụ được giao" },
  TASK_BLOCKED: { icon: "⛔", label: "Nhiệm vụ bị chặn" },
  TASK_DEADLINE_REMINDER: { icon: "⏰", label: "Sắp đến hạn nhiệm vụ" },
  TASK_OVERDUE_REMINDER: { icon: "⚠️", label: "Nhiệm vụ quá hạn" },
  VISA_SUBMITTED: {
    icon: "🛂",
    label: "Hồ sơ visa đã nộp",
    buildHref: (p) => {
      const id = str(p, "visaId");
      return id ? `/visas/${id}` : null;
    },
  },
  VISA_APPOINTMENT_SCHEDULED: {
    icon: "🛂",
    label: "Đã đặt lịch hẹn visa",
    buildHref: (p) => {
      const id = str(p, "visaId");
      return id ? `/visas/${id}` : null;
    },
  },
  VISA_RESULT: {
    icon: "🛂",
    label: "Có kết quả visa",
    buildHref: (p) => {
      const id = str(p, "visaId");
      return id ? `/visas/${id}` : null;
    },
  },
};

export function notificationEventMeta(event: string): NotificationEventMeta {
  return NOTIFICATION_EVENT_META[event] ?? { icon: "🔔", label: event };
}
