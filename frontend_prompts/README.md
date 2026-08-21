# Frontend Prompts – Abroad Scholarship System

Bộ prompt này dành cho việc xây dựng frontend chính thức cho hệ thống Abroad Scholarship System sau khi backend Phase 01–14 đã hoàn thành.

## Cách triển khai

Thực hiện tuần tự:

00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11

Prompt chỉ điều phối. Nội dung nghiệp vụ chi tiết vẫn lấy từ SRS, backend source, API conventions, RBAC matrix và các tài liệu Phase 01–14 hiện có trong repository.

Không xây toàn bộ frontend trong một lần. Sau mỗi phase phải build/typecheck/lint/test và tạo checkpoint.

## Cấu trúc

- `00-context/` – context và nguyên tắc frontend
- `01-foundation/` – audit và architecture
- `02-auth-shell/` – API client, auth, RBAC, app shell
- `03-crm/` – Lead, Student, Case
- `04-commercial-profile/` – Contract, Payment, Assessment, Roadmap, Profile, Writing
- `05-admission/` – University, Program, Scholarship, Choice, Application, Offer
- `06-visa-partner/` – Visa, Pre-departure, Enrollment, Partner, Commission
- `07-platform/` – Documents, Notifications, Reporting
- `08-portal/` – Student/Parent Portal
- `09-ux/` – Design system, responsive, accessibility, performance, polish
- `10-qa/` – Frontend QA, security, regression, UAT
- `11-deploy/` – Frontend deployment readiness

## Nguyên tắc quan trọng

Frontend là client của backend hiện tại. Không tạo business logic song song, không tự suy diễn trạng thái, không bypass RBAC, không truy cập R2 trực tiếp bằng credential, và không sử dụng mock API để thay thế API thật trong implementation production.
