# DOMAIN MAP

Phase: 01B – Target Architecture
Date: 2026-08-18

Domain boundary tối thiểu theo yêu cầu của `01-discovery/02_TARGET_ARCHITECTURE.md`:
Identity, CRM, Case Management, Counseling, Profile Development, Admission, Visa, Commercial, Partners,
Documents, Notifications, Reporting.

Ghi chú: "Counseling" và "Profile Development" trong đề bài phase 01B trùng ý nghĩa nghiệp vụ với các
module M05–M11 của SRS (Assessment, Roadmap, Academic/Test, Competition, Research, Leadership/Activity,
Writing Portfolio — SRS mục 4). Để tránh tạo hai domain-boundary trùng ý nghĩa (vi phạm Hard Rule "Không
tạo entity trùng tên hoặc trùng ý nghĩa" áp dụng tương tự ở mức domain), gộp thành **một domain vật lý
`counseling`** sở hữu toàn bộ entity thuộc "quản lý phát triển hồ sơ học sinh trước admission". "Profile
Development" được giữ như **tên nghiệp vụ/label**, không phải một module code riêng. Quyết định này được
ghi lại tại `DECISIONS.md` (ARCH-DEC-02).

## 1. Identity

**Mục đích nghiệp vụ**: M01 (Identity & Access) — đăng nhập, MFA, session, user, role, permission,
offboarding; đồng thời là nơi đặt audit nền tảng dùng chung.

**Sở hữu (ghi)**: User, Role, Permission, RolePermission, AuditLog.

**Expose cho domain khác**: `AuthGuard`/policy engine (kiểm tra permission + scope + field policy),
`AuditRecorder` (ghi audit log chuẩn hóa), `CurrentPrincipal` (user/role/scope hiện tại của request).

**Phụ thuộc vào**: không phụ thuộc domain nghiệp vụ nào (domain nền tảng, load đầu tiên — Phase 03).

**Không sở hữu**: bất kỳ entity nghiệp vụ nào khác (Student, Case, Contract…).

## 2. CRM

**Mục đích nghiệp vụ**: M02 (Lead/CRM) — nguồn lead, campaign, lead owner, qualification, chuyển đổi sang
Contract.

**Sở hữu (ghi)**: Lead.

**Expose cho domain khác**: `LeadConversionService` (dùng bởi flow ký hợp đồng ở `commercial` +
`case-management` — xem TARGET_ARCHITECTURE mục 12, saga Lead → Contract → Student + Case).

**Phụ thuộc vào**: `identity` (owner = User), `case-management` (kết quả convert trỏ tới
`converted_student_id`).

## 3. Case Management

**Mục đích nghiệp vụ**: M03 (Student/PHHS Profile — phần lõi định danh) + M04 (Case Management) + M20
(Task/KPI, phần entity Task/TaskDependency — KPI tổng hợp thuộc `reporting`).

**Sở hữu (ghi)**: Student, StudentContact, Case, CaseMember, Task, TaskDependency.

**Expose cho domain khác**: `CaseAccessService` (kiểm tra case ownership/membership — dùng bởi mọi domain
khác cho record-scope authorization), `TaskService` (module khác có thể tạo task template khi stage
thay đổi — SRS mục 6.18: "Task template có thể sinh tự động khi stage/case thay đổi").

**Phụ thuộc vào**: `identity` (owner/collaborator = User), `crm` (Student có thể sinh ra từ Lead), 
`commercial` (Case liên kết `contract_id`).

**Là trục trung tâm**: theo SRS mục 19, Case + Student là 2 trong 5 trục dữ liệu xuyên suốt — hầu hết
domain khác giữ FK `case_id`/`student_id` trỏ về đây.

## 4. Counseling (bao gồm "Profile Development")

**Mục đích nghiệp vụ**: M05 (Assessment & Gap), M06 (Roadmap), M07 (Academic/Test), M08 (Competition),
M09 (Research), M10 (Leadership/Activity), M11 (Writing Portfolio).

**Sở hữu (ghi)**: Assessment, Roadmap, RoadmapMilestone, AcademicRecord, TestRecord, Competition,
ResearchProject, Activity, WritingArtifact, WritingVersion.

**Expose cho domain khác**: `ProfileSnapshotService` (dùng bởi `admission` cho School Selection/Application
eligibility — cần dữ liệu GPA, test score, roadmap status), `RoadmapApprovalGate` (dùng để enforce ràng
buộc "Roadmap chỉ Active sau approval" trước khi các domain khác — VD `admission` — cho phép School
Selection tiến hành theo SRS mục 6.5/6.10).

**Phụ thuộc vào**: `case-management` (mọi entity đều gắn `case_id`/`student_id`), `documents` (evidence
liên kết tới Document — SRS mục 6.7: "Mỗi evidence có thể liên kết tới Document").

## 5. Admission

**Mục đích nghiệp vụ**: M12 (University & Scholarship Master), School Selection (mục 6.10, không có
module ID riêng nhưng có entity `UniversityChoice`), M13 (Application), M14 (Scholarship Application),
M15 (Offer).

**Sở hữu (ghi)**: University, Program, ScholarshipMaster, UniversityChoice, Application,
ApplicationChecklist, Offer, ScholarshipApplication.

**Expose cho domain khác**: `AdmissionOutcomeService` (dùng bởi `visa` để biết "đã chọn nơi nhập học" —
điều kiện vào của Visa stage S10 theo SRS mục 5).

**Phụ thuộc vào**: `case-management` (Application/UniversityChoice gắn `student_id`), `counseling`
(eligibility dựa trên assessment/profile), `documents` (checklist item gắn document), `partners`
(Program có thể liên kết `partner_program_id` — xem gap ghi nhận ở REPOSITORY_AUDIT mục 5.6).

**Ghi chú**: University/Program/ScholarshipMaster là **master data do domain `admission` sở hữu**
(không phải reference data tĩnh trong `packages/config`) vì cần workflow verified_by/last_verified_at
(SRS mục 6.9) — tách biệt hoàn toàn khỏi `Partner`/`PartnerProgram` (Hard Rule #2, và cảnh báo SRS mục 14
dòng 759).

## 6. Visa

**Mục đích nghiệp vụ**: M16 (Visa), M17 (Pre-departure & Enrollment).

**Sở hữu (ghi)**: Visa (bao gồm thuộc tính pre-departure/enrollment/closure theo checklist — SRS mục
6.15 không định nghĩa entity riêng ngoài Visa trong Data Model mục 7; checklist pre-departure/enrollment
được model như checklist con của Visa hoặc Case closure, xem ASSUMPTIONS nếu cần entity riêng khi vào
Phase 09).

**Expose cho domain khác**: `VisaStatusService` (dùng bởi `case-management` để cho phép Case chuyển sang
Closed — SRS mục 9: "Closed phải có closure reason và checklist bắt buộc"; mục 6.15: "Closure chỉ được
phép khi enrollment... và công nợ được xử lý").

**Phụ thuộc vào**: `case-management`, `admission` (cần offer đã accept để biết quốc gia/trường nhập học),
`documents` (finance evidence, passport), `commercial` (kiểm tra công nợ trước khi Closure).

## 7. Commercial

**Mục đích nghiệp vụ**: M18 (Contract & Payment).

**Sở hữu (ghi)**: Contract, ContractTemplate, ContractAmendment, Payment.

**Expose cho domain khác**: `ContractActivationService` (trigger tạo Student+Case khi Signed — dùng bởi
saga ở `case-management`), `DebtStatusService` (dùng bởi `visa`/`case-management` để chặn Closure khi còn
công nợ), `CommissionTriggerEvent` (phát sự kiện cho `partners` khi payment đủ điều kiện tính hoa hồng —
"Commission phải tách khỏi student payment", SRS mục 6.17).

**Phụ thuộc vào**: `identity` (approval theo monetary threshold cần role GĐĐH — SRS mục 6.16),
`case-management` (Contract gắn `student_id`), `documents` (signed artifact lưu như Document immutable).

## 8. Partners

**Mục đích nghiệp vụ**: M19 (Partner CRM).

**Sở hữu (ghi)**: Partner, PartnerProgram, PartnerDocument, PartnerStudentLink, CommissionRule,
CommissionTransaction.

**Expose cho domain khác**: `PartnerProgramLookupService` (dùng bởi `admission` nếu Program liên kết
partner program).

**Phụ thuộc vào**: `commercial` (commission trigger từ payment), `admission`/`case-management` (link qua
`PartnerStudentLink` tới student/case/application — bảng trung gian, đúng SRS mục 6.17: "liên kết nhiều
student/case/application bằng bảng trung gian", tránh duplicate Partner theo Hard Rule #2).

## 9. Documents

**Mục đích nghiệp vụ**: M21 (Document Management).

**Sở hữu (ghi)**: Document, DocumentAccess.

**Expose cho domain khác**: `DocumentUploadService`, `SignedUrlService` (nơi duy nhất được gọi object
storage SDK — TARGET_ARCHITECTURE mục 15), `DocumentVersionService`.

**Phụ thuộc vào**: `identity` (permission/audit), mọi domain khác tham chiếu tới Document qua
`document_id` (không phụ thuộc ngược lại domain nghiệp vụ nào).

**Là trục trung tâm**: theo SRS mục 19, Document là 1 trong 5 trục dữ liệu xuyên suốt — không thuộc sở
hữu của bất kỳ domain nghiệp vụ nào khác dù được dùng ở khắp nơi (Application checklist, Visa evidence,
Contract signed artifact, Writing artifact file, evidence cho Assessment/Competition/Research...).

## 10. Notifications

**Mục đích nghiệp vụ**: M22 (Notification & Communication) + phần Comment/Approval của mục 21 (Comment
gắn "entity_type/id" là cross-domain, Approval dùng chung cho Contract/Roadmap/…).

**Sở hữu (ghi)**: Notification, Comment, Approval.

**Expose cho domain khác**: `NotificationDispatcher` (mọi domain phát event, `notifications` nhận và
resolve recipient + gửi), `ApprovalWorkflowService` (dùng bởi `commercial` cho contract approval,
`counseling` cho roadmap approval).

**Phụ thuộc vào**: `identity` (recipient = User), `case-management` (owner/collaborator resolution).

## 11. Reporting

**Mục đích nghiệp vụ**: M23 (phần Reporting của Audit/Reporting — Audit log thuộc `identity`,
Dashboard/report thuộc đây).

**Sở hữu (ghi)**: không sở hữu bảng nghiệp vụ nào (read-only aggregation layer).

**Expose cho domain khác**: không expose ngược — đây là domain "cuối chuỗi", chỉ tiêu thụ dữ liệu từ tất
cả domain khác qua view/aggregation query hoặc qua service interface đọc.

**Phụ thuộc vào**: tất cả domain (đọc).

## 12. Bảng tổng hợp phụ thuộc (dependency direction)

```
identity  ←── (mọi domain phụ thuộc vào identity cho auth/audit)

crm ──→ case-management ──→ commercial
                │                │
                ├──→ counseling ─┤
                │       │        │
                │       ↓        │
                └──→ admission ──┼──→ visa
                        │        │      │
                        ↓        ↓      ↓
                    documents ←──┴── partners
                        ↑
                 notifications (nhận event từ mọi domain)
                        ↑
                   reporting (đọc tất cả, không ai đọc reporting)
```

Không có chu trình phụ thuộc vòng tròn (no circular dependency) ở mức domain — mỗi mũi tên là hướng "phụ
thuộc vào" (A → B nghĩa là A gọi service interface của B). `documents` và `notifications` là domain dùng
chung (shared/infrastructure-like) được nhiều domain khác gọi tới nhưng bản thân không phụ thuộc ngược
vào domain nghiệp vụ cụ thể nào ngoài `identity`.
