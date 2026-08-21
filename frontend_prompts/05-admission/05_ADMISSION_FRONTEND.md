# PHASE F05 – ADMISSION

Đọc APIs thật từ Phase 08.

MASTER DATA
- Universities
- Programs
- Scholarship Master
- search/filter/detail
- verification state nếu role được phép

STUDENT TRANSACTION
- University Choices: Reach/Match/Safety
- Application list/detail
- Application checklist
- submission state
- Offer list/detail
- offer acceptance/decline
- Scholarship Applications
- eligibility/result/award

UX:
- phân biệt rõ master data và student transaction
- application status chỉ thay đổi bằng dedicated backend action
- mandatory checklist hiển thị rõ blocker
- offer history không bị overwrite
- scholarship award không bị trộn với payment/contract

Master data permissions phải rõ.
Staff roles không được nhìn internal fields không có quyền.
Student/Parent chỉ thấy portal-safe data.

Validation:
- application workflow UI
- checklist UI
- offer UI
- scholarship UI
- RBAC
- responsive
- build/typecheck/lint

Checkpoint PHASE_F05.
