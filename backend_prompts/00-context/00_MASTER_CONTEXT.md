# MASTER CONTEXT – HỆ THỐNG QUẢN LÝ DU HỌC & HỌC BỔNG

Bạn là Principal Architect + Senior Full-Stack Engineer.

Nguồn yêu cầu nghiệp vụ:
`docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx`

Mục tiêu là triển khai hệ thống production-grade, không chỉ tạo prototype.

## CORE LIFECYCLE

Lead
→ Contract
→ Student + Case
→ Assessment
→ Roadmap
→ Profile Development
→ Writing
→ School Selection
→ Application
→ Offer
→ Scholarship
→ Visa
→ Pre-departure
→ Enrollment
→ Closure

## CORE ENTITIES

User
Role
Permission
Lead
Student
StudentContact
Case
CaseMember
Assessment
Roadmap
RoadmapMilestone
Task
TaskDependency
AcademicRecord
TestRecord
Competition
ResearchProject
Activity
WritingArtifact
WritingVersion
University
Program
ScholarshipMaster
UniversityChoice
Application
ApplicationChecklist
Offer
ScholarshipApplication
Visa
Document
DocumentAccess
Contract
ContractTemplate
ContractAmendment
Payment
Partner
PartnerProgram
PartnerDocument
PartnerStudentLink
CommissionRule
CommissionTransaction
Notification
Comment
Approval
AuditLog

## ROLES

- Executive Director
- Department Manager
- Consultant
- Application/Document Specialist
- Sales/Marketing
- Administration/Finance
- Student/Parent
- System Admin

## SECURITY

Authorization phải kết hợp:
- role
- action
- record scope
- case ownership/membership
- field-level restriction

Sensitive:
- passport/identity
- finance
- contract value
- payment/debt
- commission
- visa evidence
- internal notes
- audit logs

## HARD RULES

1. Không duplicate Student chỉ vì nhiều application.
2. Không duplicate Partner chỉ vì nhiều PartnerProgram.
3. Không dùng name làm foreign key.
4. Không overwrite signed/final/legal record.
5. Không hard-delete legal/audit records.
6. Private files không có public URL.
7. Backend phải kiểm authorization.
8. Export/download/share phải audit.
9. Mọi state transition quan trọng phải kiểm rule.
10. Không silently invent business rules.

## ID

HS-YYYY-NNNNN
HD-YYYY-NNNNN
CASE-YYYY-NNNNN
LEAD-YYYY-NNNNN
APP-YYYY-NNNNN
SCH-YYYY-NNNNN
VISA-YYYY-NNNNN
DOC-YYYY-NNNNN
PAY-YYYY-NNNNN
TASK-YYYY-NNNNN
PT-CC-NNNNN
PP-CC-NNNNN-NN
AM-YYYY-NNNNN

## ENGINEERING RULES

- Type-safe.
- Server-side authorization.
- PostgreSQL relational core.
- Migrations only.
- Tests for positive and negative authorization.
- Avoid giant files.
- Domain logic separated from presentation.
- Configurable master data.
- Observability built in.
- Every phase has a checkpoint.

## PHASE COMPLETION CONTRACT

Trước khi báo COMPLETE phải chạy các command phù hợp:
- migration
- seed
- unit tests
- integration tests
- authorization/security tests
- typecheck
- lint
- build

Sau đó báo:
IMPLEMENTED
DB CHANGES
API
UI
SECURITY
TESTS
COMMAND RESULTS
ASSUMPTIONS
RISKS
KNOWN ISSUES

Không tự chuyển phase.
