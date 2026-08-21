import { ApiError } from "./types";

/// Server-error → Vietnamese message mapping (F03 instruction: "form phải map lỗi từ server").
/// Every code here is a real code the backend throws (grepped from leads.service.ts/
/// cases.service.ts) — never invented ahead of the backend contract. Falls back to the
/// server's own `message` for any code not explicitly mapped, so a new/unmapped backend error
/// is still shown, just less polished.
const CODE_MESSAGES: Record<string, string> = {
  LEAD_NOT_FOUND: "Không tìm thấy lead.",
  LEAD_ALREADY_CONVERTED: "Lead này đã được chuyển đổi.",
  LEAD_LOST: "Lead đã đánh dấu mất, không thể chuyển đổi.",
  INVALID_MERGE_TARGET: "Học sinh được chọn để gộp không hợp lệ.",
  CASE_NOT_FOUND: "Không tìm thấy case.",
  STUDENT_NOT_FOUND: "Không tìm thấy học sinh.",
  DUPLICATE_ACTIVE_CASE: "Học sinh này đã có case đang hoạt động.",
  INVALID_STATUS_TRANSITION: "Không thể chuyển sang trạng thái này từ trạng thái hiện tại.",
  OPEN_TASKS_REMAIN: "Còn task chưa hoàn thành — không thể đóng case.",
  OUTSTANDING_DEBT_REMAINS: "Còn công nợ chưa thanh toán — không thể đóng case.",
  VISA_IN_PROGRESS: "Hồ sơ visa đang xử lý — không thể đóng case.",
  ENROLLMENT_NOT_CONFIRMED: "Chưa xác nhận nhập học — không thể đóng case.",
  PRE_DEPARTURE_CHECKLIST_INCOMPLETE: "Checklist trước khi khởi hành chưa hoàn tất — không thể đóng case.",
  CASE_MEMBER_NOT_FOUND: "Người dùng này không phải thành viên đang hoạt động của case.",
  PERMISSION_DENIED: "Chỉ chủ sở hữu case (hoặc vai trò GLOBAL) mới có quyền thao tác này.",
  VALIDATION_ERROR: "Dữ liệu nhập không hợp lệ.",

  // F04 — Contract (apps/api/src/modules/commercial/contracts)
  CONTRACT_NOT_FOUND: "Không tìm thấy hợp đồng.",
  INVALID_CONTRACT_STATE: "Hợp đồng không ở trạng thái cho phép thao tác này.",
  APPROVAL_THRESHOLD_EXCEEDED: "Giá trị hợp đồng vượt ngưỡng phê duyệt — chỉ Giám đốc điều hành mới có thể duyệt.",
  NO_ACTIVE_CASE_FOR_STUDENT: "Học sinh chưa có case đang hoạt động để liên kết hợp đồng.",
  CASE_ALREADY_LINKED: "Case này đã liên kết với một hợp đồng khác.",
  CONTRACT_NOT_YET_SIGNED: "Hợp đồng chưa được ký — chưa thể thực hiện thao tác này.",
  NO_MATERIAL_CHANGE: "Không có thay đổi thực sự nào so với điều khoản hiện tại.",

  // F04 — Payment (apps/api/src/modules/commercial/payments)
  PAYMENT_NOT_FOUND: "Không tìm thấy khoản thanh toán.",
  PAYMENT_ALREADY_RESOLVED: "Khoản thanh toán này đã được xử lý xong (đã thanh toán/hoàn tiền/miễn).",
  DUPLICATE_PAYMENT_REFERENCE: "Mã tham chiếu giao dịch này đã được sử dụng.",
  OVERPAYMENT_NOT_ALLOWED: "Số tiền vượt quá số còn phải thu — cần xác nhận cho phép trả dư.",
  CONTRACT_CLOSED: "Hợp đồng đã kết thúc — không thể ghi nhận thêm giao dịch.",
  REFUND_EXCEEDS_NET_PAID: "Số tiền hoàn vượt quá số đã thanh toán thực nhận.",
  CURRENCY_MISMATCH: "Loại tiền tệ không khớp với hợp đồng.",
  DUPLICATE_INSTALLMENT: "Đã tồn tại kỳ thanh toán với số thứ tự này.",

  // F04 — Assessment (apps/api/src/modules/counseling/assessments)
  ASSESSMENT_NOT_FOUND: "Không tìm thấy đánh giá.",
  OPEN_ASSESSMENT_EXISTS: "Đã có phiên bản đánh giá đang mở (nháp/đang xem xét) — hãy hoàn tất trước khi tạo mới.",
  CHANGE_REASON_REQUIRED: "Cần nêu lý do thay đổi khi tạo phiên bản đánh giá mới sau khi đã được duyệt.",
  INVALID_ASSESSMENT_STATE: "Đánh giá không ở trạng thái cho phép thao tác này.",

  // F04 — Roadmap / Milestone (apps/api/src/modules/counseling/roadmaps)
  ROADMAP_NOT_FOUND: "Không tìm thấy lộ trình.",
  ASSESSMENT_BASELINE_REQUIRED: "Lộ trình cần một đánh giá làm cơ sở trước khi được duyệt.",
  ASSESSMENT_BASELINE_NOT_APPROVED: "Đánh giá cơ sở của lộ trình chưa được duyệt.",
  INVALID_ROADMAP_STATUS_TRANSITION: "Không thể chuyển lộ trình sang trạng thái này.",
  INVALID_ROADMAP_STATE: "Lộ trình không ở trạng thái cho phép thao tác này.",
  MILESTONE_NOT_FOUND: "Không tìm thấy mốc lộ trình.",
  MILESTONE_TERMINAL_STATE: "Mốc lộ trình đã ở trạng thái kết thúc (hoàn thành/hủy) — không thể chỉnh sửa.",
  INVALID_MILESTONE_STATUS_TRANSITION: "Không thể chuyển mốc lộ trình sang trạng thái này.",
  PREREQUISITE_NOT_DONE: "Còn mốc/nhiệm vụ phụ thuộc chưa hoàn tất.",
  SELF_DEPENDENCY: "Một mốc không thể phụ thuộc vào chính nó.",
  CROSS_ROADMAP_DEPENDENCY: "Không thể tạo phụ thuộc giữa hai lộ trình khác nhau.",
  CIRCULAR_DEPENDENCY: "Thao tác này sẽ tạo ra vòng lặp phụ thuộc.",
  DUPLICATE_DEPENDENCY: "Phụ thuộc này đã tồn tại.",
  DEPENDENCY_NOT_FOUND: "Không tìm thấy phụ thuộc này.",
  OWNER_NOT_FOUND: "Không tìm thấy người phụ trách được chỉ định.",
  INVALID_MILESTONE_OWNER: "Người phụ trách phải là thành viên của case.",

  // F04 — Profile Evidence (apps/api/src/modules/counseling/profile-evidence)
  ACADEMIC_RECORD_NOT_FOUND: "Không tìm thấy hồ sơ học tập.",
  TEST_RECORD_NOT_FOUND: "Không tìm thấy kết quả bài thi.",
  DUPLICATE_TEST_ATTEMPT: "Đã tồn tại lượt thi này (cùng loại bài thi và số lần thi).",
  COMPETITION_NOT_FOUND: "Không tìm thấy hoạt động thi đấu.",
  RESEARCH_PROJECT_NOT_FOUND: "Không tìm thấy dự án nghiên cứu.",
  ACTIVITY_NOT_FOUND: "Không tìm thấy hoạt động ngoại khóa.",

  // F04 — Writing (apps/api/src/modules/counseling/writing)
  WRITING_ARTIFACT_NOT_FOUND: "Không tìm thấy bài viết.",
  WRITING_VERSION_NOT_FOUND: "Không tìm thấy phiên bản bài viết.",
  INVALID_WRITING_STATUS_TRANSITION: "Không thể chuyển bài viết sang trạng thái này.",
  WRITING_ARTIFACT_SUBMITTED: "Bài viết đã nộp — không thể tạo thêm phiên bản.",
};

export function crmErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
  }
  return CODE_MESSAGES[error.code] ?? error.message ?? "Đã xảy ra lỗi.";
}
