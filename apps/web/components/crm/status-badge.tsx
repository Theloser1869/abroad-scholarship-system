import { Badge, type BadgeVariant } from "@/components/ui/badge";

/// Maps a domain status enum (Lead/Case) onto the shared four-variant Badge — no domain enum
/// lives inside `components/ui/badge.tsx` itself (F03 instruction: reuse the F01 semantic
/// Badge, never invent a parallel color system per domain).
export function StatusBadge({ status, variantMap, label }: { status: string; variantMap: Record<string, BadgeVariant>; label?: string }) {
  return <Badge variant={variantMap[status] ?? "neutral"}>{label ?? status}</Badge>;
}

export const LEAD_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NEW: "info",
  CONTACTED: "info",
  QUALIFIED: "warning",
  CONSULTATION: "warning",
  CONTRACTING: "warning",
  CONVERTED: "success",
  LOST: "danger",
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  QUALIFIED: "Đủ điều kiện",
  CONSULTATION: "Tư vấn",
  CONTRACTING: "Đang ký hợp đồng",
  CONVERTED: "Đã chuyển đổi",
  LOST: "Mất",
};

export const CASE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  OPEN: "info",
  ACTIVE: "warning",
  ON_HOLD: "neutral",
  COMPLETED: "success",
  CLOSED: "success",
  ARCHIVED: "neutral",
};

export const CASE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mở",
  ACTIVE: "Đang xử lý",
  ON_HOLD: "Tạm hoãn",
  COMPLETED: "Hoàn thành",
  CLOSED: "Đã đóng",
  ARCHIVED: "Lưu trữ",
};

export const CONTRACT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  APPROVED: "info",
  SENT: "info",
  SIGNED: "success",
  ACTIVE: "success",
  COMPLETED: "success",
  LIQUIDATED: "neutral",
  ARCHIVED: "neutral",
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Đang xét duyệt",
  APPROVED: "Đã duyệt",
  SENT: "Đã gửi khách hàng",
  SIGNED: "Đã ký",
  ACTIVE: "Đang hiệu lực",
  COMPLETED: "Hoàn thành",
  LIQUIDATED: "Đã thanh lý",
  ARCHIVED: "Lưu trữ",
};

export const PAYMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "neutral",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  REFUNDED: "info",
  WAIVED: "neutral",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  REFUNDED: "Đã hoàn tiền",
  WAIVED: "Đã miễn",
};

export const ASSESSMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  APPROVED: "success",
  SUPERSEDED: "neutral",
};

export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Đang xét duyệt",
  APPROVED: "Đã duyệt",
  SUPERSEDED: "Đã thay thế",
};

export const ROADMAP_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  APPROVED: "info",
  ACTIVE: "success",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};

export const ROADMAP_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Đang xét duyệt",
  APPROVED: "Đã duyệt",
  ACTIVE: "Đang thực hiện",
  COMPLETED: "Hoàn thành",
  ARCHIVED: "Lưu trữ",
};

export const MILESTONE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  DONE: "success",
  CANCELLED: "neutral",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  BLOCKED: "Bị chặn",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export const WRITING_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  REVISION: "warning",
  FINAL: "info",
  SUBMITTED: "success",
};

export const WRITING_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Đang xét duyệt",
  REVISION: "Cần chỉnh sửa",
  FINAL: "Bản cuối",
  SUBMITTED: "Đã nộp",
};

export const LOR_REQUEST_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NOT_REQUESTED: "neutral",
  REQUESTED: "info",
  IN_PROGRESS: "warning",
  RECEIVED: "success",
  DECLINED: "danger",
};

export const LOR_SUBMISSION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "warning",
  SUBMITTED: "success",
  NOT_REQUIRED: "neutral",
};

export const MASTER_DATA_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

export const MASTER_DATA_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
};

export const UNIVERSITY_CHOICE_TIER_VARIANT: Record<string, BadgeVariant> = {
  REACH: "warning",
  MATCH: "info",
  SAFETY: "success",
};

export const UNIVERSITY_CHOICE_TIER_LABEL: Record<string, string> = {
  REACH: "Vượt tầm (Reach)",
  MATCH: "Phù hợp (Match)",
  SAFETY: "An toàn (Safety)",
};

export const UNIVERSITY_CHOICE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PROPOSED: "neutral",
  SHORTLISTED: "info",
  CONFIRMED: "success",
  REMOVED: "danger",
};

export const UNIVERSITY_CHOICE_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Đề xuất",
  SHORTLISTED: "Vào danh sách rút gọn",
  CONFIRMED: "Đã xác nhận",
  REMOVED: "Đã loại bỏ",
};

export const APPLICATION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLANNING: "neutral",
  PREPARING: "neutral",
  READY_FOR_REVIEW: "warning",
  SUBMITTED: "info",
  OFFER: "success",
  WAITLIST: "warning",
  REJECT: "danger",
  WITHDRAWN: "neutral",
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Lên kế hoạch",
  PREPARING: "Đang chuẩn bị",
  READY_FOR_REVIEW: "Sẵn sàng xét duyệt",
  SUBMITTED: "Đã nộp",
  OFFER: "Đã có thư mời",
  WAITLIST: "Danh sách chờ",
  REJECT: "Từ chối",
  WITHDRAWN: "Đã rút",
};

export const CHECKLIST_ITEM_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
  WAIVED: "info",
};

export const CHECKLIST_ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn tất",
  WAIVED: "Miễn trừ",
};

export const OFFER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  RECEIVED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  EXPIRED: "neutral",
  WITHDRAWN: "neutral",
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Đã nhận",
  ACCEPTED: "Đã chấp nhận",
  DECLINED: "Đã từ chối",
  EXPIRED: "Hết hạn",
  WITHDRAWN: "Đã rút",
};

export const SCHOLARSHIP_APPLICATION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLANNING: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  INTERVIEW: "warning",
  AWARDED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

export const SCHOLARSHIP_APPLICATION_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Lên kế hoạch",
  SUBMITTED: "Đã nộp",
  UNDER_REVIEW: "Đang xét duyệt",
  INTERVIEW: "Phỏng vấn",
  AWARDED: "Đã trao học bổng",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

export const VISA_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NOT_STARTED: "neutral",
  PREPARING: "neutral",
  READY: "warning",
  SUBMITTED: "info",
  APPOINTMENT: "info",
  INTERVIEW: "warning",
  GRANTED: "success",
  REFUSED: "danger",
  WITHDRAWN: "neutral",
};

export const VISA_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng",
  SUBMITTED: "Đã nộp",
  APPOINTMENT: "Đã hẹn lịch",
  INTERVIEW: "Phỏng vấn",
  GRANTED: "Đã cấp",
  REFUSED: "Bị từ chối",
  WITHDRAWN: "Đã rút",
};

export const ENROLLMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLANNED: "neutral",
  CONFIRMED: "success",
  WITHDRAWN: "danger",
};

export const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  PLANNED: "Dự kiến",
  CONFIRMED: "Đã xác nhận",
  WITHDRAWN: "Đã rút",
};

export const PARTNER_DOCUMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  EXPIRED: "danger",
  SUPERSEDED: "neutral",
  ARCHIVED: "neutral",
};

export const PARTNER_DOCUMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  ACTIVE: "Hiệu lực",
  EXPIRED: "Hết hạn",
  SUPERSEDED: "Đã thay thế",
  ARCHIVED: "Lưu trữ",
};

export const PARTNER_LINK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

export const PARTNER_LINK_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  ARCHIVED: "Đã lưu trữ",
};

export const COMMISSION_TRANSACTION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "neutral",
  ELIGIBLE: "info",
  CALCULATED: "info",
  APPROVED: "warning",
  PAYABLE: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

export const COMMISSION_TRANSACTION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xử lý",
  ELIGIBLE: "Đủ điều kiện",
  CALCULATED: "Đã tính toán",
  APPROVED: "Đã duyệt",
  PAYABLE: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
};

export const DOCUMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  APPROVED: "info",
  FINAL: "info",
  SUBMITTED: "success",
  ARCHIVED: "neutral",
};

export const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  REVIEW: "Đang xét duyệt",
  APPROVED: "Đã duyệt",
  FINAL: "Bản cuối",
  SUBMITTED: "Đã nộp",
  ARCHIVED: "Lưu trữ",
};

/// Independent lifecycle from `DocumentStatus` — malware-scan result (F07 instruction §9).
export const DOCUMENT_SCAN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "warning",
  CLEAN: "success",
  INFECTED: "danger",
  ERROR: "danger",
};

export const DOCUMENT_SCAN_STATUS_LABEL: Record<string, string> = {
  PENDING: "Đang quét virus",
  CLEAN: "Sạch — có thể tải xuống",
  INFECTED: "Nhiễm mã độc — bị chặn",
  ERROR: "Lỗi quét — bị chặn",
};

/// F08 — Task had no frontend status map through F07 (no staff Task route was ever built,
/// F07's own finding); Portal's task list/detail is the first place this app renders one.
export const TASK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  DONE: "success",
  CANCELLED: "neutral",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  BLOCKED: "Bị chặn",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

/// F08 — `StudentContact.portalStatus`, the Parent portal-access lifecycle
/// (`PortalAccessService.inviteParent`/`acceptInvitation`/`revokeParentAccess`).
export const PORTAL_LINK_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NONE: "neutral",
  INVITED: "warning",
  ACTIVE: "success",
  REVOKED: "danger",
};

export const PORTAL_LINK_STATUS_LABEL: Record<string, string> = {
  NONE: "Chưa mời",
  INVITED: "Đã mời — chờ chấp nhận",
  ACTIVE: "Đang hoạt động",
  REVOKED: "Đã thu hồi",
};
