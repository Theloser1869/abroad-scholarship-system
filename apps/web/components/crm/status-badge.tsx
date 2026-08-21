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
