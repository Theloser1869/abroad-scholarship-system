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
  STUDENT_PROFILE_INCOMPLETE: "Hồ sơ học sinh còn thiếu thông tin bắt buộc (ngày sinh, quốc gia/ngành/đợt mục tiêu, mục tiêu học bổng, hoặc lớp) — cần bổ sung trước khi duyệt đánh giá.",
  INVALID_STATUS_TRANSITION: "Không thể chuyển sang trạng thái này từ trạng thái hiện tại.",
  OPEN_TASKS_REMAIN: "Còn task chưa hoàn thành — không thể đóng case.",
  OUTSTANDING_DEBT_REMAINS: "Còn công nợ chưa thanh toán — cần xử lý trước khi tiếp tục.",
  VISA_IN_PROGRESS: "Hồ sơ visa đang xử lý — không thể đóng case.",
  ENROLLMENT_NOT_CONFIRMED: "Chưa xác nhận nhập học — không thể đóng case.",
  PRE_DEPARTURE_CHECKLIST_INCOMPLETE: "Checklist trước khi khởi hành chưa hoàn tất — không thể đóng case.",
  // Client Acceptance Remediation DEC-06/07/08 (GAP-007) — unified Closure/Liquidation
  // workflow (apps/api/src/modules/case-management/closure).
  DOCUMENT_HANDOVER_INCOMPLETE: "Chưa xác nhận bàn giao tài liệu — cần xác nhận trước khi đóng hồ sơ.",
  OVERRIDE_REASON_REQUIRED: "Trưởng phòng/Giám đốc điều hành cần nhập lý do xử lý ngoại lệ (exception) trước khi thực hiện thay HCTH.",
  CASE_NOT_CLOSED: "Chỉ có thể xác nhận thanh lý sau khi hồ sơ đã được đóng.",
  ALREADY_LIQUIDATED: "Hồ sơ đã được thanh lý — không thể xác nhận lại (bất biến).",
  USE_UNIFIED_CLOSURE_WORKFLOW: "Hợp đồng này đã liên kết với một case — vui lòng thực hiện Hoàn tất/Thanh lý qua luồng Đóng hồ sơ hợp nhất của case, không qua hợp đồng trực tiếp.",
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
  PAYMENT_REQUIRED_FOR_ACTIVATION: "Cần thanh toán tối thiểu 30% giá trị hợp đồng trước khi kích hoạt (DEC-01).",
  CLOSURE_REASON_REQUIRED: "Cần nhập lý do/biên bản thanh lý trước khi thanh lý hợp đồng.",

  // F04 — Payment (apps/api/src/modules/commercial/payments)
  PAYMENT_NOT_FOUND: "Không tìm thấy khoản thanh toán.",
  PAYMENT_ALREADY_RESOLVED: "Khoản thanh toán này đã được xử lý xong (đã thanh toán/hoàn tiền/miễn).",
  DUPLICATE_PAYMENT_REFERENCE: "Mã tham chiếu giao dịch này đã được sử dụng.",
  OVERPAYMENT_NOT_ALLOWED: "Số tiền vượt quá số còn phải thu — cần xác nhận cho phép trả dư.",
  CONTRACT_CLOSED: "Hợp đồng đã kết thúc — không thể ghi nhận thêm giao dịch.",
  REFUND_EXCEEDS_NET_PAID: "Số tiền hoàn vượt quá số đã thanh toán thực nhận.",
  // Shared code across Payment (F04) and CommissionTransaction (F06) — the same generic
  // wording covers both "doesn't match the contract" and "rule currency vs. source currency".
  CURRENCY_MISMATCH: "Loại tiền tệ không khớp.",
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

  // F05 — Admission Master Data (apps/api/src/modules/admission/master-data)
  UNIVERSITY_NOT_FOUND: "Không tìm thấy trường đại học.",
  DUPLICATE_UNIVERSITY: "Đã tồn tại trường đại học này (cùng tên và quốc gia).",
  PROGRAM_NOT_FOUND: "Không tìm thấy chương trình học.",
  DUPLICATE_PROGRAM: "Đã tồn tại chương trình học này (cùng trường, bậc học, ngành, đợt tuyển sinh).",
  SCHOLARSHIP_MASTER_NOT_FOUND: "Không tìm thấy học bổng.",
  DUPLICATE_SCHOLARSHIP_MASTER: "Đã tồn tại học bổng này (cùng đơn vị cấp, tên, trường/chương trình).",

  // F05 — University Choice (apps/api/src/modules/admission/university-choices)
  UNIVERSITY_CHOICE_NOT_FOUND: "Không tìm thấy lựa chọn trường.",
  DUPLICATE_UNIVERSITY_CHOICE: "Học sinh này đã có lựa chọn cho chương trình này.",

  // F05 — Application / Checklist (apps/api/src/modules/admission/applications)
  APPLICATION_NOT_FOUND: "Không tìm thấy hồ sơ ứng tuyển.",
  APPLICATION_WITHDRAWN: "Hồ sơ đã rút — không thể chỉnh sửa.",
  ACTIVE_APPLICATION_EXISTS: "Học sinh này đã có hồ sơ ứng tuyển đang hoạt động cho chương trình này.",
  CHECKLIST_INCOMPLETE: "Còn hạng mục checklist bắt buộc chưa hoàn tất/miễn trừ.",
  INVALID_APPLICATION_STATUS_TRANSITION: "Không thể chuyển hồ sơ ứng tuyển sang trạng thái này.",
  INVALID_APPLICATION_STATE: "Hồ sơ ứng tuyển không ở trạng thái cho phép thao tác này.",
  CHECKLIST_ITEM_NOT_FOUND: "Không tìm thấy hạng mục checklist.",

  // F05 — Offer (apps/api/src/modules/admission/offers)
  OFFER_NOT_FOUND: "Không tìm thấy thư mời nhập học.",
  OFFER_REQUIRES_SUBMITTED_APPLICATION: "Chỉ có thể ghi nhận thư mời khi hồ sơ đã Nộp hoặc trong Danh sách chờ.",
  INVALID_OFFER_STATE: "Thư mời này đã được phản hồi — không thể phản hồi lại.",

  // F05 — Scholarship Application (apps/api/src/modules/admission/scholarship-applications)
  SCHOLARSHIP_APPLICATION_NOT_FOUND: "Không tìm thấy hồ sơ học bổng.",
  SCHOLARSHIP_APPLICATION_CLOSED: "Hồ sơ học bổng đã kết thúc — không thể chỉnh sửa.",
  ELIGIBILITY_NOT_CONFIRMED: "Cần xác nhận đủ điều kiện trước khi nộp hồ sơ học bổng.",
  INVALID_SCHOLARSHIP_APPLICATION_STATUS_TRANSITION: "Không thể chuyển hồ sơ học bổng sang trạng thái này.",
  INVALID_SCHOLARSHIP_APPLICATION_STATE: "Hồ sơ học bổng không ở trạng thái cho phép thao tác này.",

  // F06 — Visa (apps/api/src/modules/visa/visas)
  VISA_NOT_FOUND: "Không tìm thấy hồ sơ visa.",
  VISA_CLOSED: "Hồ sơ visa đã kết thúc — không thể chỉnh sửa.",
  ACTIVE_VISA_EXISTS: "Case này đã có hồ sơ visa đang hoạt động.",
  INVALID_VISA_STATUS_TRANSITION: "Không thể chuyển hồ sơ visa sang trạng thái này.",
  INVALID_VISA_STATE: "Hồ sơ visa không ở trạng thái cho phép thao tác này.",

  // F06 — Visa checklist templates (apps/api/src/modules/visa/visa-checklist-templates)
  DUPLICATE_VISA_CHECKLIST_TEMPLATE: "Đã tồn tại mẫu checklist này (cùng quốc gia, loại visa, tên hạng mục).",

  // F06 — Enrollment (apps/api/src/modules/visa/enrollments)
  ENROLLMENT_NOT_FOUND: "Không tìm thấy hồ sơ nhập học.",
  ENROLLMENT_WITHDRAWN: "Hồ sơ nhập học đã rút — không thể chỉnh sửa.",
  INVALID_ENROLLMENT_TARGET: "Thư mời được chọn không hợp lệ để nhập học (chỉ chấp nhận thư mời đã được chấp nhận).",
  CONFIRMED_ENROLLMENT_EXISTS: "Case này đã có hồ sơ nhập học được xác nhận — cần rút hồ sơ đó trước.",
  INVALID_ENROLLMENT_STATE: "Hồ sơ nhập học không ở trạng thái cho phép thao tác này.",

  // F06 — Partner master (apps/api/src/modules/partners/partner-master)
  PARTNER_NOT_FOUND: "Không tìm thấy đối tác.",
  DUPLICATE_PARTNER: "Đã tồn tại đối tác này (cùng tên và quốc gia).",

  // F06 — Partner Program (apps/api/src/modules/partners/partner-programs)
  PARTNER_PROGRAM_NOT_FOUND: "Không tìm thấy chương trình đối tác.",
  DUPLICATE_PARTNER_PROGRAM: "Đã tồn tại chương trình đối tác này (cùng tên, bậc học, ngành, đợt tuyển sinh).",

  // F06 — Partner Document (apps/api/src/modules/partners/partner-documents)
  PARTNER_DOCUMENT_NOT_FOUND: "Không tìm thấy tài liệu đối tác.",
  PARTNER_DOCUMENT_NOT_EDITABLE: "Tài liệu đối tác này không còn ở trạng thái nháp — không thể chỉnh sửa.",

  // F06 — Partner Student Link (apps/api/src/modules/partners/partner-student-links)
  PARTNER_STUDENT_LINK_NOT_FOUND: "Không tìm thấy liên kết đối tác — học sinh.",
  DUPLICATE_PARTNER_STUDENT_LINK: "Đã tồn tại liên kết đang hoạt động cho đối tác/học sinh/case/hồ sơ này.",
  PARTNER_STUDENT_LINK_ARCHIVED: "Liên kết này đã được lưu trữ — không thể chỉnh sửa.",

  // F06 — Commission Transaction (apps/api/src/modules/partners/commission-transactions)
  COMMISSION_TRANSACTION_NOT_FOUND: "Không tìm thấy giao dịch hoa hồng.",
  COMMISSION_TRANSACTION_NOT_EDITABLE: "Chỉ có thể sửa liên kết khi giao dịch đang ở trạng thái chờ xử lý.",
  COMMISSION_TRANSACTION_CLOSED: "Giao dịch hoa hồng đã kết thúc.",
  INVALID_COMMISSION_TRANSACTION_STATE: "Giao dịch hoa hồng không ở trạng thái cho phép thao tác này.",
  PARTNER_STUDENT_LINK_REQUIRED: "Đối tác này chưa có liên kết đang hoạt động với học sinh nguồn — không thể ghi nhận hoa hồng.",
  DUPLICATE_COMMISSION_TRANSACTION: "Đã tồn tại giao dịch hoa hồng cho nguồn và quy tắc này.",
  COMMISSION_RULE_NOT_FOUND: "Không tìm thấy quy tắc hoa hồng phù hợp.",
  COMMISSION_RULE_MISSING: "Giao dịch này chưa có quy tắc hoa hồng để tính toán.",
  COMMISSION_RULE_INCOMPLETE: "Quy tắc hoa hồng thiếu tỷ lệ phần trăm hoặc số tiền cơ sở.",
  COMMISSION_SOURCE_MISSING: "Giao dịch này chưa có nguồn để đọc số tiền.",
  FIXED_AMOUNT_REQUIRED: "Cần nhập số tiền cố định khi cơ sở tính là Cố định.",
  PERCENTAGE_RATE_REQUIRED: "Cần nhập tỷ lệ phần trăm khi cơ sở tính không phải Cố định.",
  FIXED_AMOUNT_NOT_ALLOWED: "Không được nhập số tiền cố định khi cơ sở tính không phải Cố định.",
  PERCENTAGE_RATE_NOT_ALLOWED: "Không được nhập tỷ lệ phần trăm khi cơ sở tính là Cố định.",

  // F07 — Documents (apps/api/src/modules/documents/documents)
  FILE_REQUIRED: "Cần đính kèm một tệp.",
  UNSUPPORTED_MIME_TYPE: "Loại tệp này không được hỗ trợ.",
  EXTENSION_MISMATCH: "Phần mở rộng tệp không khớp với loại tệp đã khai báo.",
  MIME_SPOOFING_DETECTED: "Nội dung tệp không khớp với loại tệp đã khai báo.",
  EMPTY_FILE: "Tệp tải lên đang trống.",
  FILE_TOO_LARGE: "Tệp vượt quá kích thước tối đa cho phép.",
  DOCUMENT_NOT_FOUND: "Không tìm thấy tài liệu hoặc bạn không có quyền truy cập.",
  DOCUMENT_ARCHIVED: "Tài liệu đã được lưu trữ — không thể chỉnh sửa hoặc tạo phiên bản mới.",
  DOCUMENT_ACCESS_EXPIRED: "Quyền truy cập tài liệu này đã hết hạn.",
  DOCUMENT_NOT_READY: "Tài liệu chưa thể tải xuống (đang chờ hoặc không vượt qua quét virus).",
  INVALID_OR_EXPIRED_DOWNLOAD_TOKEN: "Đường dẫn tải xuống không hợp lệ hoặc đã hết hạn — vui lòng thử lại.",

  // F07 — Notifications (apps/api/src/modules/notifications/notifications)
  NOTIFICATION_NOT_FOUND: "Không tìm thấy thông báo.",

  // F07 — Reports (apps/api/src/modules/reporting/reports) — reuses the existing generic
  // PERMISSION_DENIED entry above (`ReportsService.assertRole` throws the same code/shape).

  // F08 — Portal (apps/api/src/modules/portal/portal, .../portal-access) — reuses the
  // existing CASE_NOT_FOUND entry above for PortalService.resolveCase's "student has no
  // case yet" 404 (same real code, no portal-specific variant exists).
  TASK_NOT_FOUND: "Không tìm thấy nhiệm vụ hoặc bạn không có quyền truy cập.",
  INVALID_TASK_STATUS_TRANSITION: "Không thể chuyển nhiệm vụ sang trạng thái này.",
  BLOCKER_REQUIRED: "Cần nêu lý do khi chuyển nhiệm vụ sang trạng thái bị chặn.",
  OUTPUT_REQUIRED: "Cần nhập kết quả công việc (output) trước khi đánh dấu hoàn thành.",
  DOCUMENT_NOT_OWNED: "Bạn chỉ có thể gửi tài liệu do chính mình tải lên.",
  STUDENT_CONTACT_NOT_FOUND: "Không tìm thấy liên hệ này.",
  PARENT_ALREADY_ACTIVE: "Liên hệ này đã có quyền truy cập cổng thông tin đang hoạt động.",
  CONTACT_EMAIL_REQUIRED: "Liên hệ này chưa có email — cần bổ sung email trước khi mời.",
  PARENT_NOT_ACTIVE: "Liên hệ này hiện chưa có quyền truy cập đang hoạt động để thu hồi.",
  INVALID_OR_USED_INVITATION: "Đường dẫn mời này không hợp lệ hoặc đã được sử dụng.",
  CREDENTIALS_REQUIRED: "Cần nhập tên đăng nhập và mật khẩu để tạo tài khoản cổng thông tin.",
  EMAIL_BELONGS_TO_STAFF_ACCOUNT: "Email này thuộc về một tài khoản nhân viên nội bộ, không thể dùng cho phụ huynh.",

  // Client Acceptance Remediation GAP-001/GAP-002 (apps/api/src/common/export/export-row-cap.ts,
  // apps/api/src/modules/commercial/contracts/contracts.service.ts)
  EXPORT_ROW_LIMIT_EXCEEDED: "Kết quả xuất vượt quá giới hạn cho phép — vui lòng thu hẹp bộ lọc rồi thử lại.",
};

export function crmErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Đã xảy ra lỗi không xác định. Vui lòng thử lại.";
  }
  const mapped = CODE_MESSAGES[error.code];
  if (mapped) return mapped;
  // F09 hardening (instruction §8/§20 "422/validation: map tới field") — a 422/400 request-
  // body validation failure has no specific business `code` (the backend's `ValidationPipe`
  // defaults it to the generic `BAD_REQUEST`/`UNPROCESSABLE_ENTITY`), and its top-level
  // `message` is NestJS's own generic "Bad Request Exception" text — genuinely unhelpful.
  // `ErrorContractFilter` puts the REAL field-level constraint messages (class-validator's
  // own strings, e.g. "email must be an email") in `details` instead
  // (`error-contract.filter.ts`'s own doc comment: "details is reserved for class-validator's
  // field-level errors") — surfaced here since no caller in this app reads `.details` on its
  // own. Not full per-field mapping (class-validator's default messages aren't structured as
  // `{field, message}` pairs), but a real, specific list instead of a generic phrase.
  if (Array.isArray(error.details)) {
    const detailMessages = error.details.filter((d): d is string => typeof d === "string" && d.length > 0);
    if (detailMessages.length > 0) return detailMessages.join(" ");
  }
  return error.message || "Đã xảy ra lỗi.";
}
