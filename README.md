# Claude Code Implementation Pack
## Hệ thống quản lý du học & học bổng

Bộ thư mục này biến SRS thành một quy trình triển khai tuần tự cho Claude Code.

## 1. Mục tiêu

Không đưa toàn bộ yêu cầu vào Claude Code trong một lần.

Claude phải đi theo chuỗi:

00 Context
→ 01 Discovery
→ 02 Foundation
→ 03 Security
→ 04 Core CRM
→ 05 Commercial
→ 06 Operations
→ 07 Profile
→ 08 Admission
→ 09 Visa
→ 10 Partners
→ 11 Portal
→ 12 Platform
→ 13 QA
→ 14 Production

Mỗi phase:
1. đọc prompt tương ứng;
2. đọc SRS;
3. kiểm tra code hiện tại;
4. triển khai;
5. chạy migration/test/typecheck/lint/build;
6. cập nhật checkpoint;
7. chỉ chuyển phase sau khi phase hiện tại PASS.

## 2. Thứ tự chạy prompt

### Bắt buộc
- 00-context/00_MASTER_CONTEXT.md
- 01-discovery/01_REPOSITORY_AUDIT.md
- 01-discovery/02_TARGET_ARCHITECTURE.md
- 02-foundation/01_DATABASE_FOUNDATION.md
- 02-foundation/02_API_FOUNDATION.md
- 03-security/01_AUTH.md
- 03-security/02_RBAC.md
- 03-security/03_AUDIT.md
- 04-core-crm/01_LEAD.md
- 04-core-crm/02_STUDENT_CASE.md
- 05-commercial/01_CONTRACT.md
- 05-commercial/02_PAYMENT.md
- 06-operations/01_TASK.md
- 06-operations/02_NOTIFICATION.md
- 07-profile/01_ASSESSMENT_ROADMAP.md
- 07-profile/02_PROFILE_EVIDENCE.md
- 07-profile/03_WRITING.md
- 08-admission/01_MASTER_DATA.md
- 08-admission/02_APPLICATION.md
- 08-admission/03_OFFER_SCHOLARSHIP.md
- 09-visa/01_VISA.md
- 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md
- 10-partners/01_PARTNER_CRM.md
- 11-portal/01_STUDENT_PARENT_PORTAL.md
- 12-platform/01_DOCUMENTS.md
- 12-platform/02_INTEGRATIONS_JOBS.md
- 12-platform/03_REPORTING.md
- 13-qa/01_FULL_TRACEABILITY.md
- 13-qa/02_SECURITY_REVIEW.md
- 13-qa/03_UAT_REVIEW.md
- 14-production/01_PRODUCTION_HARDENING.md
- 14-production/02_FINAL_ARCHITECT_REVIEW.md

## 3. Quy tắc quan trọng

- Không bỏ qua phase nếu phase trước còn FAIL.
- Không tạo entity trùng tên hoặc trùng ý nghĩa.
- Không sửa schema thủ công ngoài migration.
- Không đưa authorization chỉ ở frontend.
- Không dùng public URL cho private document.
- Không overwrite signed/final/legal records.
- Không hard-delete audit/legal records.
- Mọi thay đổi nhạy cảm phải có audit.
- Khi requirement mơ hồ, tạo assumption và ghi vào docs/ASSUMPTIONS.md.
- Khi phát hiện requirement mâu thuẫn, dừng feature và ghi vào docs/DECISIONS.md.

## 4. Cách gọi Claude Code

### Bước A
Mở repository dự án.

### Bước B
Đảm bảo SRS có sẵn trong repository, ví dụ:
docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx

### Bước C
Dán prompt 00-context/00_MASTER_CONTEXT.md.

### Bước D
Sau khi Claude báo PASS, dán prompt tiếp theo theo thứ tự.

### Bước E
Sau mỗi prompt, dán:
checkpoints/PHASE_CHECKPOINT.md

với `<PHASE_NAME>` thay bằng phase hiện tại.

## 5. Cơ chế checkpoint

Mỗi phase phải tạo:
docs/phase-status/<phase>.md

Nội dung tối thiểu:
- status
- scope
- implemented
- files changed
- migrations
- API
- UI
- tests
- assumptions
- risks
- known issues
- commands
- next dependency

## 6. Nếu Claude làm sai

Không bắt Claude tiếp tục xây thêm.

Dùng:
checkpoints/RECOVERY_FROM_WRONG_IMPLEMENTATION.md

## 7. Cấu trúc source code khuyến nghị

```text
project/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ ui/
│  ├─ auth/
│  ├─ config/
│  ├─ types/
│  └─ domain/
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ fixtures/
├─ storage/
├─ workers/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  ├─ security/
│  └─ fixtures/
├─ docs/
│  ├─ architecture/
│  ├─ api/
│  ├─ database/
│  ├─ security/
│  └─ phase-status/
└─ scripts/
```

Nếu repository hiện tại không theo cấu trúc này, Claude phải thích nghi thay vì rewrite vô điều kiện.
