# FRONTEND PHASE MAP

F01 Foundation / Architecture
F02 API + Auth + RBAC + Shell
F03 CRM
F04 Commercial + Profile
F05 Admission
F06 Visa + Partner
F07 Documents + Notifications + Reporting
F08 Student/Parent Portal
F09 UX + Accessibility + Performance
F10 QA + Security + UAT
F11 Deployment Readiness

Quy tắc:
- F01/F02 phải PASS trước khi xây domain UI.
- Mỗi phase tạo checkpoint.
- Không sang phase tiếp theo nếu validation phase hiện tại FAIL/BLOCKED.
- Frontend không thay thế backend authorization.
- Backend API là source of truth cho business state.
